# StudySync

A smart task and productivity management platform for individuals and teams to organize projects, manage tasks, track productivity, and improve work planning.

---

## Technology Stack

### Frontend
- **Framework:** React 19 (via Vite)
- **Styling:** Tailwind CSS v4
- **Routing:** React Router v7
- **HTTP Client:** Axios
- **Icons & Data Visualization:** React Icons, Recharts

### Backend
- **Runtime:** Node.js
- **Framework:** Express.js
- **Authentication:** JSON Web Tokens (JWT), bcryptjs
- **Utilities:** CORS, dotenv, multer, exceljs

### Database
- **Database:** MongoDB
- **ODM:** Mongoose

---

## Development Servers

| Application | URL | Default Port |
| :--- | :--- | :--- |
| **Frontend** | [http://localhost:5173](http://localhost:5173) | `5173` |
| **Backend API** | [http://localhost:5000](http://localhost:5000) | `5000` |

---

## Quick Start Guide

### 1. Backend Setup
```bash
cd Backend
npm install
```

Configure your environment variables by copying `.env.example`:
```bash
cp .env.example .env
```
Ensure `MONGO_URI`, `PORT`, and `JWT_SECRET` are configured.

Start the backend server:
```bash
npm run dev
# Or production mode:
npm start
```
Verify the health check: [http://localhost:5000/api/health](http://localhost:5000/api/health)

---

### 2. Frontend Setup
```bash
cd Frontend
npm install
```

Start the Vite development server:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## Architecture Overview (Phase 0)

```text
                    USER
                     │
                     ▼
              React Frontend (Vite)
                     │
               Axios Instance (`services/api.js`)
                     │
              HTTP / REST API (CORS enabled)
                     │
                     ▼
             Express Backend (`server.js`)
                     │
        ┌────────────┼────────────┐
        │            │            │
     Routes      Middleware    Controllers
                                  │
                                  ▼
                              Services (Business Logic)
                                  │
                                  ▼
                              Mongoose Models
                                  │
                                  ▼
                              MongoDB
```

### Health Check Endpoint
- **URL:** `/api/health`
- **Method:** `GET`
- **Response:**
```json
{
  "success": true,
  "message": "API is running"
}
```
