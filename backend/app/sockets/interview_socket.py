from flask_socketio import emit, join_room, leave_room
from flask_jwt_extended import decode_token
from app import socketio, db
from app.models.session   import InterviewSession
from app.models.interview import Interview
from app.models.user      import User
from datetime import datetime


def get_user_from_token(token):
    try:
        decoded = decode_token(token)
        user_id = int(decoded["sub"])
        return User.query.get(user_id)
    except Exception:
        return None


@socketio.on("connect")
def on_connect(auth):
    try:
        token = (auth or {}).get("token", "")
        user  = get_user_from_token(token)
        if not user:
            return False
        print("[Socket] Connected: " + user.full_name)
        emit("connected", {"message": "Welcome " + user.full_name})
    except Exception as e:
        print("[Socket] Connect error: " + str(e))
        return False


@socketio.on("disconnect")
def on_disconnect():
    print("[Socket] Client disconnected")


@socketio.on("join_user_room")
def on_join_user_room(data):
    """Each logged-in user joins their own notification room."""
    try:
        token = data.get("token", "")
        user  = get_user_from_token(token)
        if not user:
            return
        room = "user_" + str(user.id)
        join_room(room)
        emit("user_room_joined", {"room": room, "user_id": user.id})
        print("[Socket] " + user.full_name + " joined personal room: " + room)
    except Exception as e:
        print("[Socket] user_room error: " + str(e))


@socketio.on("join_session")
def on_join_session(data):
    try:
        token         = data.get("token", "")
        session_token = data.get("session_token", "")
        user    = get_user_from_token(token)
        session = InterviewSession.query.filter_by(session_token=session_token).first()
        if not user or not session:
            emit("error", {"message": "Invalid session"})
            return
        room = "session_" + str(session.id)
        join_room(room)
        interview = Interview.query.get(session.interview_id)
        emit("session_joined", {
            "session_id": session.id,
            "status":     session.status,
            "interview":  interview.title if interview else "",
            "current_q":  session.current_question_index
        })
        print("[Socket] " + user.full_name + " joined " + room)
    except Exception as e:
        emit("error", {"message": str(e)})


@socketio.on("watch_interview")
def on_watch_interview(data):
    """Company watches an interview for real-time updates."""
    try:
        token        = data.get("token", "")
        interview_id = data.get("interview_id", 0)
        user = get_user_from_token(token)
        if not user:
            return
        room = "interview_" + str(interview_id)
        join_room(room)
        emit("watching", {"interview_id": interview_id})
        print("[Socket] " + user.full_name + " watching interview " + str(interview_id))
    except Exception as e:
        print("[Socket] watch error: " + str(e))


@socketio.on("leave_session")
def on_leave_session(data):
    try:
        session_token = data.get("session_token", "")
        session = InterviewSession.query.filter_by(session_token=session_token).first()
        if session:
            leave_room("session_" + str(session.id))
    except Exception:
        pass


@socketio.on("heartbeat")
def on_heartbeat(data):
    emit("heartbeat_ack", {"timestamp": datetime.utcnow().isoformat()})


@socketio.on("cheat_detected")
def on_cheat_detected(data):
    try:
        token         = data.get("token", "")
        session_token = data.get("session_token", "")
        
        # cheat_type might be a dict if frontend sends object
        raw_type = data.get("cheat_type", "unknown")
        if isinstance(raw_type, dict):
            cheat_type  = str(raw_type.get("type", "unknown"))
            severity    = str(raw_type.get("severity", data.get("severity", "medium")))
            description = str(raw_type.get("description", data.get("description", "")))
        else:
            cheat_type  = str(raw_type)
            severity    = str(data.get("severity", "medium"))
            description = str(data.get("description", ""))

        user    = get_user_from_token(token)
        session = InterviewSession.query.filter_by(session_token=session_token).first()
        if not user or not session:
            return

        from app.services.cheat_detector import get_cheat_detector
        cd = get_cheat_detector()
        log, should_disq, cheat_score = cd.log_cheat_event(
            session_id=session.id,
            cheat_type=cheat_type,
            severity=severity,
            description=description
        )

        room = "session_" + str(session.id)
        if should_disq:
            emit("session_terminated", {
                "reason": "Too many violations. Interview terminated.",
                "cheat_score": cheat_score
            }, to=room)
        elif cheat_score > 40:
            emit("session_warning", {
                "message": "Warning: Suspicious activity detected (" + cheat_type + ")",
                "cheat_score": cheat_score,
                "severity": severity
            }, to=room)

    except Exception as e:
        print("[Socket] cheat error: " + str(e))