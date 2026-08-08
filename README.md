# InterviewAI - AI-Powered Interview System

A complete AI interview platform built with Groq LLaMA3, React 18, Flask, SQLite.

## Quick Start

Terminal 1 - Backend:
  cd backend
  .venv\Scripts\Activate.ps1
  python run.py

Terminal 2 - Frontend:
  cd frontend
  npm run dev

Open: http://localhost:5173

## Default Login
  Admin: admin@interviewai.com / admin123

## Test Flow
  1. Login as Admin
  2. Register as Company -> Create Interview -> Upload JD
  3. Generate Topics -> Review -> Approve
  4. Register as Candidate -> Get invited
  5. Start Interview -> Answer AI questions
  6. View Results and Report

## Features
  - AI Interviewer (Alex) powered by Groq LLaMA3
  - Dynamic questions based on answers
  - Voice-to-text input (Web Speech API)
  - Anti-cheat detection
  - Multi-dimensional scoring
  - AI-generated reports
  - Mock interview practice
  - Admin panel

## Groq API Key (Free)
  Get free key at: https://console.groq.com
  Add to backend/.env as GROQ_API_KEY=your_key