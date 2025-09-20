# CodeQuest Backend

A RESTful API server for the CodeQuest gamified task management platform that provides user authentication, task management, and GitHub integration for tracking coding activities and progress.

## 🚀 Features

- **User Authentication**: JWT-based authentication with email/password and GitHub OAuth
- **Task Management**: Create, track, and complete programming tasks with difficulty levels
- **GitHub Integration**: Automatic commit tracking, streak calculation, and contribution history
- **Gamification System**: Level progression, experience points, and HP (Health Points) system
- **User Profiles**: Comprehensive user statistics and progress tracking
- **RESTful API**: Clean and well-structured API endpoints

## 🛠️ Tech Stack

### Backend

- **Node.js** - JavaScript runtime
- **Express.js** - Web application framework
- **TypeScript** - Type-safe JavaScript
- **MongoDB** - NoSQL database
- **Mongoose** - MongoDB object modeling
- **JWT** - JSON Web Token authentication
- **Passport.js** - Authentication middleware
- **bcryptjs** - Password hashing
- **Axios** - HTTP client for external APIs
- **Zod** - Schema validation
- **date-fns** - Date utility library

### Development Tools

- **ts-node-dev** - TypeScript development server
- **Morgan** - HTTP request logger
- **CORS** - Cross-origin resource sharing
- **dotenv** - Environment variable management

## 📋 Prerequisites

- Node.js 20.19.0 or higher
- Yarn 4.7.0 or higher
- MongoDB database
- GitHub OAuth App (for GitHub integration)

## 🚀 Getting Started

1. **Clone the repository**

   ```bash
   git clone <repository-url>
   cd codequest-backend
   ```

2. **Install dependencies**

   ```bash
   yarn install
   ```

3. **Set up environment variables**
   Create a `.env` file in the root directory:

   ```env
   PORT=8080
   MONGO_URI=mongodb://localhost:27017/codequest
   JWT_SECRET=your_jwt_secret_key
   GITHUB_CLIENT_ID=your_github_client_id
   GITHUB_CLIENT_SECRET=your_github_client_secret
   GITHUB_CALLBACK_URL=http://localhost:8080/api/auth/github/callback
   ```

4. **Start MongoDB**
   Make sure MongoDB is running on your system

5. **Start the development server**

   ```bash
   yarn dev
   ```

6. **Verify the server is running**
   Navigate to [http://localhost:8080](http://localhost:8080) to see the API status.

## 📁 Project Structure

```
src/
├── config/
│   └── passport.ts          # Passport.js configuration for OAuth
├── controllers/
│   ├── authController.ts    # User authentication logic
│   ├── githubController.ts  # GitHub API integration
│   └── taskController.ts    # Task management logic
├── middleware/
│   └── verifyToken.ts       # JWT token verification
├── models/
│   ├── Task.ts             # Task data model
│   └── User.ts             # User data model
├── routes/
│   ├── authRoutes.ts       # Authentication routes
│   ├── githubRoutes.ts     # GitHub integration routes
│   └── taskRoutes.ts       # Task management routes
├── validators/
│   └── userValidator.ts    # Input validation schemas
└── index.ts               # Main server file
```

## 🔧 Available Scripts

- `yarn dev` - Start development server with hot reload

## 🌟 API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/github` - GitHub OAuth login
- `GET /api/auth/github/callback` - GitHub OAuth callback
- `GET /api/profile` - Get user profile (protected)

### Tasks

- `GET /api/tasks` - Get user's tasks (protected)
- `POST /api/tasks` - Create new task (protected)
- `PATCH /api/tasks/:id/complete` - Complete task (protected)

### GitHub Integration

- `GET /api/github/token` - Get GitHub access token (protected)
- `POST /api/github/update-streak` - Update user's GitHub streak (protected)

## 🎮 Gamification System

### User Progression

- **Level System**: Users level up by completing tasks
- **Experience Points**: Gained from completing tasks (5-15 XP based on difficulty)
- **HP System**: Health points that can be restored on level up
- **Streak Tracking**: GitHub commit streaks for daily coding habits

### Task Difficulty Levels

- **Easy**: 5 XP
- **Medium**: 10 XP
- **Hard**: 15 XP

### Level Requirements

- Experience required for next level: `level * 15`
- HP increases by `10 + level * 2` on level up

## 🔐 Authentication

The API uses JWT-based authentication with the following features:

- Secure password hashing with bcryptjs
- 7-day token expiration
- Protected routes with middleware verification
- GitHub OAuth integration for seamless login

## 🗄️ Database Schema

### User Model

```typescript
{
  username: string (unique)
  email: string (unique)
  passwordHash?: string
  githubId?: string
  githubAccessToken?: string
  avatarUrl?: string
  displayName: string
  totalExperience: number
  currentHP: number
  maxHP: number
  currentLevelXP: number
  levelUpXP: number
  rank: number
  level: number
  streak: number
  longestStreak: number
  totalContributions: number
  lastCommitDate?: string
  tasksCompleted: ObjectId[]
}
```

### Task Model

```typescript
{
  title: string
  description?: string
  difficulty: "easy" | "medium" | "hard"
  experience: number
  creator: ObjectId
  completed: boolean
  dueDate?: Date
  createdAt: Date
}
```

## 🔗 GitHub Integration

- **OAuth Authentication**: Secure GitHub login
- **Commit Tracking**: Automatic detection of user commits
- **Streak Calculation**: UTC-based streak calculation for accuracy
- **Contribution History**: Track total contributions and activity
- **API Rate Limiting**: Proper handling of GitHub API limits

## 📝 License

This project is private and proprietary.
