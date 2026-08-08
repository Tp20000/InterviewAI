import os
import re
from app.models.answer  import Answer
from app.models.session import InterviewSession
from app.models.question import Question


class PlagiarismDetector:
    """
    Detects similarity between candidate answers.
    Uses simple TF-IDF cosine similarity (no heavy ML needed).
    Falls back gracefully if sentence-transformers not available.
    """

    def __init__(self):
        self._use_transformers = False
        self._model = None
        try:
            from sentence_transformers import SentenceTransformer
            import numpy as np
            self._model = SentenceTransformer("all-MiniLM-L6-v2")
            self._use_transformers = True
            print("[PlagiarismDetector] Using sentence-transformers")
        except Exception:
            print("[PlagiarismDetector] Using TF-IDF fallback")

    def check_answer_similarity(self, answer_text, interview_id, exclude_session_id=None):
        """
        Check if this answer is too similar to other candidates' answers.
        Returns similarity score 0.0 - 1.0
        """
        try:
            # Get all other answers for same interview questions
            other_sessions = InterviewSession.query.filter_by(
                interview_id=interview_id
            ).filter(
                InterviewSession.id != exclude_session_id
            ).all()

            if not other_sessions:
                return 0.0

            other_answers = []
            for s in other_sessions:
                answers = Answer.query.filter_by(session_id=s.id).all()
                for a in answers:
                    if a.answer_text and len(a.answer_text.strip()) > 20:
                        other_answers.append(a.answer_text)

            if not other_answers:
                return 0.0

            if self._use_transformers:
                return self._transformer_similarity(answer_text, other_answers)
            else:
                return self._tfidf_similarity(answer_text, other_answers)

        except Exception as e:
            print(f"Plagiarism check error: {e}")
            return 0.0

    def _transformer_similarity(self, text, other_texts):
        """Use sentence-transformers for semantic similarity."""
        try:
            import numpy as np
            embeddings  = self._model.encode([text] + other_texts)
            query_emb   = embeddings[0]
            other_embs  = embeddings[1:]

            similarities = []
            for emb in other_embs:
                sim = self._cosine_similarity(query_emb, emb)
                similarities.append(sim)

            return float(max(similarities)) if similarities else 0.0
        except Exception:
            return 0.0

    def _tfidf_similarity(self, text, other_texts):
        """Simple TF-IDF cosine similarity fallback."""
        try:
            from sklearn.feature_extraction.text import TfidfVectorizer
            from sklearn.metrics.pairwise import cosine_similarity

            all_texts   = [text] + other_texts
            vectorizer  = TfidfVectorizer(stop_words="english", max_features=500)
            tfidf_matrix = vectorizer.fit_transform(all_texts)

            query_vec   = tfidf_matrix[0]
            other_vecs  = tfidf_matrix[1:]
            similarities = cosine_similarity(query_vec, other_vecs)[0]

            return float(max(similarities)) if len(similarities) > 0 else 0.0
        except Exception:
            return self._jaccard_similarity(text, other_texts)

    def _jaccard_similarity(self, text, other_texts):
        """Fallback: word overlap Jaccard similarity."""
        words1 = set(self._tokenize(text))
        if not words1:
            return 0.0

        max_sim = 0.0
        for other in other_texts:
            words2 = set(self._tokenize(other))
            if not words2:
                continue
            intersection = len(words1 & words2)
            union        = len(words1 | words2)
            sim          = intersection / union if union > 0 else 0.0
            max_sim      = max(max_sim, sim)

        return max_sim

    def _tokenize(self, text):
        """Simple word tokenizer."""
        text = text.lower()
        words = re.findall(r"\b[a-z]{3,}\b", text)
        stopwords = {"the", "and", "for", "are", "but", "not", "you", "all",
                     "can", "had", "her", "was", "one", "our", "out", "day",
                     "get", "has", "him", "his", "how", "its", "may", "new",
                     "now", "old", "see", "two", "who", "did", "use", "way"}
        return [w for w in words if w not in stopwords]

    def _cosine_similarity(self, vec1, vec2):
        """Cosine similarity between two numpy arrays."""
        import numpy as np
        dot   = np.dot(vec1, vec2)
        norm1 = np.linalg.norm(vec1)
        norm2 = np.linalg.norm(vec2)
        if norm1 == 0 or norm2 == 0:
            return 0.0
        return float(dot / (norm1 * norm2))

    def detect_ai_patterns(self, text):
        """
        Heuristic detection of AI-generated text patterns.
        Returns score 0.0 - 1.0 (higher = more likely AI-generated)
        """
        if not text or len(text.strip()) < 20:
            return 0.0

        score = 0.0
        text_lower = text.lower()

        # Pattern 1: No personal pronouns (I, my, we, our)
        personal_words = ["i ", "i'", "my ", "we ", "our ", "i've", "i've", "i've"]
        has_personal   = any(w in text_lower for w in personal_words)
        if not has_personal:
            score += 0.3

        # Pattern 2: Very structured format (bullet points, numbered)
        if text.count("\n") > 3 or text.count("•") > 2:
            score += 0.2

        # Pattern 3: Common AI phrases
        ai_phrases = [
            "certainly!", "of course!", "great question",
            "it's important to note", "in conclusion",
            "to summarize", "furthermore", "moreover",
            "it is worth noting", "as an ai"
        ]
        matches = sum(1 for p in ai_phrases if p in text_lower)
        score += min(matches * 0.1, 0.3)

        # Pattern 4: Very long without personal anecdotes
        if len(text) > 800 and not has_personal:
            score += 0.2

        return min(score, 1.0)

    def is_plagiarized(self, similarity_score, threshold=0.85):
        """Check if similarity score exceeds plagiarism threshold."""
        return similarity_score >= threshold

    def is_ai_generated(self, ai_pattern_score, threshold=0.6):
        """Check if AI pattern score indicates AI generation."""
        return ai_pattern_score >= threshold


# Singleton
_plagiarism_detector = None

def get_plagiarism_detector():
    global _plagiarism_detector
    if _plagiarism_detector is None:
        _plagiarism_detector = PlagiarismDetector()
    return _plagiarism_detector