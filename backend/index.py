"""
DataDrop - Direct Streaming Backend
No file storage - chunks stream directly from sender to receiver
"""

import asyncio
import socket
import time
import json
from typing import Dict, Optional
from dataclasses import dataclass, field
from datetime import datetime

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
import uvicorn


# ============================================================================
# Configuration
# ============================================================================

CHUNK_SIZE = 1024 * 1024  # 1MB chunks for optimal speed
MAX_FILE_SIZE = 100 * 1024 * 1024 * 1024  # 100GB max


# ============================================================================
# Data Models
# ============================================================================

@dataclass
class TransferStats:
    """Track transfer statistics"""
    filename: str = ""
    total_size: int = 0
    transferred: int = 0
    start_time: float = 0
    last_update_time: float = 0
    last_bytes: int = 0
    current_speed: float = 0
    
    def update(self, bytes_received: int) -> dict:
        """Update stats and return current status"""
        self.transferred += bytes_received
        current_time = time.time()
        
        # Calculate speed (update every 100ms)
        time_diff = current_time - self.last_update_time
        if time_diff >= 0.1:
            bytes_diff = self.transferred - self.last_bytes
            self.current_speed = bytes_diff / time_diff if time_diff > 0 else 0
            self.last_update_time = current_time
            self.last_bytes = self.transferred
        
        # Calculate progress
        progress = (self.transferred / self.total_size * 100) if self.total_size > 0 else 0
        
        # Calculate ETA
        elapsed = current_time - self.start_time
        avg_speed = self.transferred / elapsed if elapsed > 0 else 0
        remaining_bytes = self.total_size - self.transferred
        eta = remaining_bytes / avg_speed if avg_speed > 0 else 0
        
        return {
            "filename": self.filename,
            "total_size": self.total_size,
            "transferred": self.transferred,
            "progress": round(progress, 2),
            "speed": self.current_speed,
            "speed_formatted": format_speed(self.current_speed),
            "transferred_formatted": format_size(self.transferred),
            "total_formatted": format_size(self.total_size),
            "eta": format_time(eta),
            "elapsed": format_time(elapsed),
        }


@dataclass
class TransferRoom:
    """A room for P2P transfer between sender and receiver"""
    room_id: str
    sender: Optional[WebSocket] = None
    receiver: Optional[WebSocket] = None
    stats: TransferStats = field(default_factory=TransferStats)
    is_active: bool = False
    created_at: float = field(default_factory=time.time)


# ============================================================================
# Utility Functions
# ============================================================================

def get_local_ip() -> str:
    """Get the local IP address of this machine"""
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"


def format_size(bytes_size: int) -> str:
    """Format bytes to human readable string"""
    if bytes_size == 0:
        return "0 B"
    
    units = ['B', 'KB', 'MB', 'GB', 'TB']
    unit_index = 0
    size = float(bytes_size)
    
    while size >= 1024 and unit_index < len(units) - 1:
        size /= 1024
        unit_index += 1
    
    return f"{size:.2f} {units[unit_index]}"


def format_speed(bytes_per_second: float) -> str:
    """Format speed to human readable string"""
    return f"{format_size(int(bytes_per_second))}/s"


def format_time(seconds: float) -> str:
    """Format seconds to human readable time"""
    if seconds < 0 or seconds == float('inf') or seconds != seconds:  # NaN check
        return "calculating..."
    
    seconds = int(seconds)
    
    if seconds < 60:
        return f"{seconds}s"
    elif seconds < 3600:
        minutes = seconds // 60
        secs = seconds % 60
        return f"{minutes}m {secs}s"
    else:
        hours = seconds // 3600
        minutes = (seconds % 3600) // 60
        return f"{hours}h {minutes}m"


def generate_room_id() -> str:
    """Generate a simple room ID"""
    import random
    import string
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=6))


# ============================================================================
# FastAPI Application
# ============================================================================

app = FastAPI(
    title="DataDrop",
    description="Direct peer-to-peer file transfer with no storage",
    version="1.0.0"
)

# CORS - Allow all origins for local network access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://datadropz.netlify.app",
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Store active transfer rooms
rooms: Dict[str, TransferRoom] = {}

# Store connected clients for status updates
connected_clients: Dict[str, WebSocket] = {}


# ============================================================================
# REST Endpoints
# ============================================================================

@app.get("/")
async def root():
    """Root endpoint with server information"""
    local_ip = get_local_ip()
    return {
        "status": "running",
        "message": "DataDrop - Fast P2P File Transfer Server",
        "local_ip": local_ip,
        "api_url": f"http://{local_ip}:8000",
        "frontend_url": f"http://{local_ip}:5173",
        "websocket_url": f"ws://{local_ip}:8000/ws",
        "active_rooms": len([r for r in rooms.values() if r.is_active]),
        "total_rooms": len(rooms),
    }


@app.get("/server-info")
async def server_info():
    """Get server information for clients"""
    local_ip = get_local_ip()
    return {
        "ip": local_ip,
        "port": 8000,
        "frontend_port": 5173,
        "url": f"http://{local_ip}:8000",
        "frontend_url": f"http://{local_ip}:5173",
        "websocket": f"ws://{local_ip}:8000/ws",
    }


@app.get("/rooms")
async def list_rooms():
    """List active transfer rooms"""
    active_rooms = []
    for room_id, room in rooms.items():
        active_rooms.append({
            "room_id": room_id,
            "has_sender": room.sender is not None,
            "has_receiver": room.receiver is not None,
            "is_active": room.is_active,
            "created_at": datetime.fromtimestamp(room.created_at).isoformat(),
        })
    return {"rooms": active_rooms}


@app.post("/create-room")
async def create_room():
    """Create a new transfer room"""
    room_id = generate_room_id()
    
    # Ensure unique room ID
    while room_id in rooms:
        room_id = generate_room_id()
    
    rooms[room_id] = TransferRoom(room_id=room_id)
    local_ip = get_local_ip()
    
    return {
        "room_id": room_id,
        "join_url": f"http://{local_ip}:5173?room={room_id}",
        "message": "Room created. Share the room ID with the receiver.",
    }


@app.delete("/rooms/{room_id}")
async def delete_room(room_id: str):
    """Delete a transfer room"""
    if room_id in rooms:
        room = rooms[room_id]
        
        # Close connections
        if room.sender:
            try:
                await room.sender.close()
            except:
                pass
        if room.receiver:
            try:
                await room.receiver.close()
            except:
                pass
        
        del rooms[room_id]
        return {"message": f"Room {room_id} deleted"}
    
    return {"error": "Room not found"}


# ============================================================================
# WebSocket Handler - Main P2P Transfer Logic
# ============================================================================

@app.websocket("/ws/{room_id}/{role}")
async def websocket_transfer(websocket: WebSocket, room_id: str, role: str):
    """
    WebSocket endpoint for P2P file transfer
    
    role: 'sender' or 'receiver'
    
    Protocol:
    1. Sender connects with role='sender'
    2. Receiver connects with role='receiver'  
    3. Sender sends: {"type": "file_info", "name": "...", "size": ...}
    4. Sender sends: {"type": "chunk", "data": "<base64>", "index": ...}
    5. Backend relays chunks directly to receiver
    6. Sender sends: {"type": "complete"}
    """
    await websocket.accept()
    
    # Validate role
    if role not in ['sender', 'receiver']:
        await websocket.send_json({"type": "error", "message": "Invalid role. Use 'sender' or 'receiver'"})
        await websocket.close()
        return
    
    # Create room if doesn't exist
    if room_id not in rooms:
        rooms[room_id] = TransferRoom(room_id=room_id)
    
    room = rooms[room_id]
    
    # Assign role to room
    if role == 'sender':
        if room.sender is not None:
            await websocket.send_json({"type": "error", "message": "Sender already connected"})
            await websocket.close()
            return
        room.sender = websocket
        await websocket.send_json({
            "type": "connected",
            "role": "sender",
            "room_id": room_id,
            "message": "Connected as sender. Waiting for receiver...",
            "receiver_connected": room.receiver is not None,
        })
        
        # Notify receiver if connected
        if room.receiver:
            try:
                await room.receiver.send_json({
                    "type": "peer_joined",
                    "peer": "sender",
                    "message": "Sender has connected",
                })
            except:
                pass
                
    else:  # receiver
        if room.receiver is not None:
            await websocket.send_json({"type": "error", "message": "Receiver already connected"})
            await websocket.close()
            return
        room.receiver = websocket
        await websocket.send_json({
            "type": "connected", 
            "role": "receiver",
            "room_id": room_id,
            "message": "Connected as receiver. Waiting for sender...",
            "sender_connected": room.sender is not None,
        })
        
        # Notify sender if connected
        if room.sender:
            try:
                await room.sender.send_json({
                    "type": "peer_joined",
                    "peer": "receiver", 
                    "message": "Receiver has connected. Ready to transfer!",
                })
            except:
                pass
    
    try:
        # Main message loop
        while True:
            message = await websocket.receive()
            
            # Handle text messages (JSON)
            if "text" in message:
                data = json.loads(message["text"])
                await handle_message(room, role, data)
            
            # Handle binary messages (file chunks)
            elif "bytes" in message:
                await handle_binary_chunk(room, role, message["bytes"])
                
    except WebSocketDisconnect:
        await handle_disconnect(room, role)
    except Exception as e:
        print(f"Error in WebSocket: {e}")
        await handle_disconnect(room, role)


async def handle_message(room: TransferRoom, role: str, data: dict):
    """Handle JSON messages"""
    msg_type = data.get("type")
    
    if msg_type == "file_info":
        # Sender is starting a new file transfer
        if role != "sender":
            return
        
        room.stats = TransferStats(
            filename=data.get("name", "unknown"),
            total_size=data.get("size", 0),
            start_time=time.time(),
            last_update_time=time.time(),
        )
        room.is_active = True
        
        # Notify receiver about incoming file
        if room.receiver:
            await room.receiver.send_json({
                "type": "file_info",
                "name": room.stats.filename,
                "size": room.stats.total_size,
                "size_formatted": format_size(room.stats.total_size),
            })
        
        # Confirm to sender
        await room.sender.send_json({
            "type": "transfer_started",
            "message": f"Starting transfer of {room.stats.filename}",
        })
    
    elif msg_type == "chunk":
        # Handle base64 encoded chunk (alternative to binary)
        if role != "sender" or not room.receiver:
            return
        
        import base64
        chunk_data = base64.b64decode(data.get("data", ""))
        chunk_index = data.get("index", 0)
        
        # Update stats
        stats_update = room.stats.update(len(chunk_data))
        
        # Relay chunk to receiver
        await room.receiver.send_json({
            "type": "chunk",
            "data": data.get("data"),
            "index": chunk_index,
        })
        
        # Send progress to both
        progress_msg = {"type": "progress", **stats_update}
        await room.sender.send_json(progress_msg)
        await room.receiver.send_json(progress_msg)
    
    elif msg_type == "complete":
        # Transfer complete
        if role != "sender":
            return
        
        room.is_active = False
        elapsed = time.time() - room.stats.start_time
        avg_speed = room.stats.total_size / elapsed if elapsed > 0 else 0
        
        complete_msg = {
            "type": "complete",
            "filename": room.stats.filename,
            "size": room.stats.total_size,
            "size_formatted": format_size(room.stats.total_size),
            "elapsed": format_time(elapsed),
            "average_speed": format_speed(avg_speed),
        }
        
        if room.sender:
            await room.sender.send_json(complete_msg)
        if room.receiver:
            await room.receiver.send_json(complete_msg)
    
    elif msg_type == "cancel":
        # Cancel transfer
        room.is_active = False
        cancel_msg = {"type": "cancelled", "message": f"Transfer cancelled by {role}"}
        
        if room.sender:
            await room.sender.send_json(cancel_msg)
        if room.receiver:
            await room.receiver.send_json(cancel_msg)
    
    elif msg_type == "ping":
        # Keep-alive ping
        await (room.sender if role == "sender" else room.receiver).send_json({"type": "pong"})


async def handle_binary_chunk(room: TransferRoom, role: str, chunk: bytes):
    """Handle binary file chunks - FASTEST method"""
    if role != "sender" or not room.receiver:
        return
    
    # Update stats
    stats_update = room.stats.update(len(chunk))
    
    # Relay binary chunk directly to receiver - NO ENCODING, maximum speed!
    try:
        await room.receiver.send_bytes(chunk)
    except Exception as e:
        print(f"Error sending chunk: {e}")
        return
    
    # Send progress updates via JSON
    progress_msg = {"type": "progress", **stats_update}
    
    try:
        await room.sender.send_json(progress_msg)
        await room.receiver.send_json(progress_msg)
    except:
        pass


async def handle_disconnect(room: TransferRoom, role: str):
    """Handle client disconnection"""
    if role == "sender":
        room.sender = None
        if room.receiver:
            try:
                await room.receiver.send_json({
                    "type": "peer_left",
                    "peer": "sender",
                    "message": "Sender disconnected",
                })
            except:
                pass
    else:
        room.receiver = None
        if room.sender:
            try:
                await room.sender.send_json({
                    "type": "peer_left", 
                    "peer": "receiver",
                    "message": "Receiver disconnected",
                })
            except:
                pass
    
    room.is_active = False
    
    # Clean up empty rooms after a delay
    if room.sender is None and room.receiver is None:
        await asyncio.sleep(60)  # Wait 1 minute before cleanup
        if room.room_id in rooms:
            room_check = rooms[room.room_id]
            if room_check.sender is None and room_check.receiver is None:
                del rooms[room.room_id]


# ============================================================================
# Health Check Endpoint
# ============================================================================

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "active_rooms": len([r for r in rooms.values() if r.is_active]),
    }


# ============================================================================
# Main Entry Point
# ============================================================================

# if __name__ == "__main__":
#     local_ip = get_local_ip()
    
#     print("\n" + "=" * 60)
#     print("🚀 FAST P2P FILE TRANSFER SERVER")
#     print("=" * 60)
#     print(f"\n📡 Local IP Address: {local_ip}")
#     print(f"\n🌐 Server URLs:")
#     print(f"   • API:       http://{local_ip}:8000")
#     print(f"   • WebSocket: ws://{local_ip}:8000/ws/{{room_id}}/{{role}}")
#     print(f"\n📱 Frontend URL (after starting frontend):")
#     print(f"   • http://{local_ip}:5173")
#     print(f"\n💡 How to use:")
#     print(f"   1. Start frontend: cd frontend && npm run dev")
#     print(f"   2. Open http://{local_ip}:5173 on this PC")
#     print(f"   3. Open same URL on other PC (same WiFi)")
#     print(f"   4. Create room on sender, join on receiver")
#     print(f"   5. Select file and transfer!")
#     print("\n" + "=" * 60)
#     print("📊 Server logs:\n")
    
#     uvicorn.run(
#         app,
#         host="127.0.0.1",
#         port=8000,
#         log_level="info",
#         ws_ping_interval=30,
#         ws_ping_timeout=30,
#         ws_max_size=16 * 1024 * 1024,  # 16MB max WebSocket message
#     )