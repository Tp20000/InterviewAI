import os
from datetime import datetime
from app import db
from app.models.cheat_log import CheatLog
from app.models.session   import InterviewSession


class CheatDetector:
    """
    Backend cheat detection and penalty calculation.
    Frontend sends cheat events, backend logs and scores them.
    """

    # Severity weights for cheat score calculation
    SEVERITY_WEIGHTS = {
        "critical": 25,
        "high":     15,
        "medium":    8,
        "low":       3
    }

    # Auto-disqualify threshold
    DISQUALIFY_THRESHOLD = 70

    def log_cheat_event(self, session_id, cheat_type, severity,
                        description="", snapshot_path=None):
        """
        Log a cheat event for a session.
        Auto-disqualifies if cheat score exceeds threshold.
        Returns (cheat_log, should_disqualify, new_cheat_score)
        """
        try:
            session = InterviewSession.query.get(session_id)
            if not session:
                return None, False, 0

            # Don't log if already disqualified
            if session.status == "disqualified":
                return None, True, session.cheat_score

            # Create cheat log
            log = CheatLog(
                session_id=session_id,
                cheat_type=cheat_type,
                severity=severity,
                description=description,
                snapshot_path=snapshot_path,
                detected_at=datetime.utcnow()
            )
            db.session.add(log)

            # Recalculate cheat score
            new_cheat_score = self._calculate_cheat_score(session_id)
            session.cheat_score = new_cheat_score

            should_disqualify = False
            if new_cheat_score >= self.DISQUALIFY_THRESHOLD:
                session.status = "disqualified"
                session.disqualification_reason = (
                    f"Cheat score {new_cheat_score}% exceeded threshold. "
                    f"Last event: {cheat_type} ({severity})"
                )
                should_disqualify = True

            db.session.commit()
            return log, should_disqualify, new_cheat_score

        except Exception as e:
            db.session.rollback()
            print(f"Cheat log error: {e}")
            return None, False, 0

    def _calculate_cheat_score(self, session_id):
        """
        Calculate cumulative cheat score for a session.
        Score is 0-100 where 100 = definitely cheating.
        """
        logs = CheatLog.query.filter_by(session_id=session_id).all()
        if not logs:
            return 0.0

        total = 0
        for log in logs:
            total += self.SEVERITY_WEIGHTS.get(log.severity, 0)

        # Cap at 100
        return min(round(total, 1), 100.0)

    def get_cheat_summary(self, session_id):
        """
        Get a summary of all cheat events for a session.
        """
        logs = CheatLog.query.filter_by(session_id=session_id).all()

        summary = {
            "total_events":   len(logs),
            "cheat_score":    self._calculate_cheat_score(session_id),
            "by_type":        {},
            "by_severity":    {"critical": 0, "high": 0, "medium": 0, "low": 0},
            "timeline":       [],
            "is_disqualified": False
        }

        session = InterviewSession.query.get(session_id)
        if session:
            summary["is_disqualified"] = session.status == "disqualified"

        for log in logs:
            # By type
            summary["by_type"][log.cheat_type] = summary["by_type"].get(log.cheat_type, 0) + 1
            # By severity
            if log.severity in summary["by_severity"]:
                summary["by_severity"][log.severity] += 1
            # Timeline
            summary["timeline"].append({
                "time":     log.detected_at.isoformat() if log.detected_at else None,
                "type":     log.cheat_type,
                "severity": log.severity,
                "desc":     log.description
            })

        return summary

    def get_cheat_level(self, cheat_score):
        """Return human-readable cheat level."""
        if cheat_score >= 70: return "DISQUALIFIED"
        if cheat_score >= 50: return "HIGH RISK"
        if cheat_score >= 30: return "SUSPICIOUS"
        if cheat_score >= 10: return "LOW RISK"
        return "CLEAN"

    def analyze_answer_timing(self, answer_text, duration_seconds):
        """
        Check if answer was submitted suspiciously fast.
        Very fast answers may indicate copy-paste.
        """
        if not answer_text:
            return False, "empty"

        word_count = len(answer_text.split())
        # Average human typing: ~40 WPM = 0.67 words/second
        expected_min_seconds = word_count / 2  # very generous minimum

        if duration_seconds < 5 and word_count > 20:
            return True, "critical"  # Definitely copy-pasted
        elif duration_seconds < expected_min_seconds * 0.3 and word_count > 50:
            return True, "high"      # Suspiciously fast
        return False, "clean"


# Singleton
_cheat_detector = None

def get_cheat_detector():
    global _cheat_detector
    if _cheat_detector is None:
        _cheat_detector = CheatDetector()
    return _cheat_detector