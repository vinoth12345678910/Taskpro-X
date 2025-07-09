# TaskProX - Real-Time Team Collaboration Platform

A modern, real-time team collaboration platform built with Next.js, Firebase, and Socket.IO for seamless team communication and project management.

## 🚀 Features

### Real-Time Communication
- **Live Chat**: Real-time messaging with instant message delivery
- **Team Rooms**: Dedicated chat rooms for different teams
- **User Presence**: See who's online and active in your team
- **Message History**: Persistent chat history with Redis/Firestore storage
- **User Types**: Support for Team Leads and Members with different permissions

### User Management
- **Firebase Authentication**: Secure user authentication and authorization
- **User Profiles**: Customizable user profiles with display names
- **Role-Based Access**: Different permissions for Team Leads vs Members
- **Session Management**: Automatic session handling and reconnection

### Team Collaboration
- **Team Creation**: Create and manage multiple teams
- **Team Membership**: Invite and manage team members
- **Real-Time Updates**: Instant notifications for team changes
- **Activity Tracking**: Monitor team activity and engagement

### Modern UI/UX
- **Responsive Design**: Works seamlessly on desktop and mobile
- **Dark/Light Mode**: Toggle between themes
- **Modern Interface**: Clean, intuitive design with Tailwind CSS
- **Real-Time Indicators**: Visual feedback for online status and typing

## 🛠 Tech Stack

### Frontend
- **Next.js 15.3.5**: React framework with App Router
- **React 19**: Latest React with concurrent features
- **TypeScript**: Type-safe development
- **Tailwind CSS 4**: Utility-first CSS framework
- **Lucide React**: Beautiful, customizable icons
- **Socket.IO Client**: Real-time communication

### Backend
- **Firebase Functions**: Serverless backend functions
- **Express.js**: Web framework for API endpoints
- **Socket.IO**: Real-time bidirectional communication
- **Firebase Firestore**: NoSQL database for data storage
- **Firebase Realtime Database**: Real-time data synchronization
- **Redis**: In-memory data store for caching and sessions

### Authentication & Security
- **Firebase Authentication**: Secure user authentication
- **CORS**: Cross-origin resource sharing configuration
- **Environment Variables**: Secure configuration management

### Deployment
- **Firebase Hosting**: Static site hosting for frontend
- **Firebase Functions**: Serverless backend deployment
- **Firebase Console**: Centralized project management

## 📁 Project Structure

```
TaskProX/
├── client/taskprox/          # Frontend (Next.js)
│   ├── app/                  # Next.js App Router
│   ├── components/           # React components
│   ├── utils/               # Utility functions
│   ├── public/              # Static assets
│   └── package.json         # Frontend dependencies
├── server/                  # Backend (Express + Socket.IO)
│   ├── app.js              # Main server file
│   └── package.json        # Backend dependencies
└── functions/              # Firebase Functions (deployment)
    ├── index.js            # Cloud Functions entry
    └── package.json        # Functions dependencies
```

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Firebase account
- Git

### Installation

1. **Clone the repository**
```bash
git clone <repository-url>
cd TaskProX
```

2. **Install frontend dependencies**
```bash
cd client/taskprox
npm install
```

3. **Install backend dependencies**
```bash
cd ../../server
npm install
```

4. **Set up Firebase**
```bash
cd ../client/taskprox
firebase login
firebase init
```

5. **Configure environment variables**
Create `.env.local` in `client/taskprox/`:
```env
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
```

### Development

1. **Start frontend development server**
```bash
cd client/taskprox
npm run dev
```
Frontend will be available at [http://localhost:3000](http://localhost:3000)

2. **Start backend server**
```bash
cd server
npm start
```
Backend will be available at [http://localhost:4000](http://localhost:4000)

3. **Start Firebase emulators (optional)**
```bash
firebase emulators:start
```

## 🚀 Deployment

### Firebase Deployment (Recommended)

1. **Build the frontend**
```bash
cd client/taskprox
npm run build
```

2. **Deploy to Firebase**
```bash
firebase deploy
```

This will deploy:
- Frontend to Firebase Hosting
- Backend to Firebase Functions
- Database rules and indexes

### Environment Setup

1. **Firebase Console Setup**
   - Create a new Firebase project
   - Enable Authentication, Firestore, and Realtime Database
   - Configure security rules
   - Set up hosting

2. **Database Configuration**
   - Firestore: For user data and team information
   - Realtime Database: For real-time chat messages
   - Redis: For session management (optional)

## 🔧 Configuration

### Firebase Configuration
- **Authentication**: Email/password, Google, GitHub
- **Firestore**: User profiles, team data, settings
- **Realtime Database**: Chat messages, online status
- **Hosting**: Static file serving with custom domain support

### Security Rules
- **Firestore**: User-based access control
- **Realtime Database**: Team-based message access
- **Functions**: Authenticated API endpoints

## 📱 Features in Detail

### Real-Time Chat
- **Instant Messaging**: Messages appear instantly for all team members
- **Typing Indicators**: See when someone is typing
- **Message History**: Persistent chat history with pagination
- **File Sharing**: Upload and share files (planned feature)
- **Emoji Support**: Rich emoji support for expressive communication

### Team Management
- **Team Creation**: Create new teams with custom names
- **Member Invitation**: Invite users via email
- **Role Assignment**: Assign Team Lead or Member roles
- **Team Settings**: Customize team preferences and permissions

### User Experience
- **Responsive Design**: Optimized for all screen sizes
- **Keyboard Shortcuts**: Quick navigation and actions
- **Notifications**: Browser notifications for new messages
- **Offline Support**: Queue messages when offline

## 🛡 Security Features

- **Firebase Authentication**: Secure user authentication
- **CORS Protection**: Cross-origin request security
- **Input Validation**: Server-side validation for all inputs
- **Rate Limiting**: Protection against spam and abuse
- **Data Encryption**: Encrypted data transmission

## 📊 Performance

- **Server-Side Rendering**: Fast initial page loads
- **Code Splitting**: Optimized bundle sizes
- **Caching**: Intelligent caching strategies
- **CDN**: Global content delivery network
- **Real-Time Optimization**: Efficient WebSocket connections

## 🔄 API Endpoints

### Authentication
- `POST /api/auth/signin` - User sign in
- `POST /api/auth/signup` - User registration
- `POST /api/auth/signout` - User sign out

### Teams
- `GET /api/teams` - Get user's teams
- `POST /api/teams` - Create new team
- `PUT /api/teams/:id` - Update team
- `DELETE /api/teams/:id` - Delete team

### Messages
- `GET /api/team/:teamId/messages` - Get team messages
- `POST /api/team/:teamId/messages` - Send message
- `DELETE /api/messages/:id` - Delete message

### WebSocket Events
- `joinRoom` - Join team chat room
- `sendMessage` - Send real-time message
- `userJoined` - User joined notification
- `userLeft` - User left notification
- `teamMembers` - Current team members list

## 🧪 Testing

```bash
# Run frontend tests
npm run test

# Run backend tests
cd server && npm test

# Run linting
npm run lint
```

## 📈 Monitoring & Analytics

- **Firebase Analytics**: User behavior tracking
- **Error Reporting**: Automatic error monitoring
- **Performance Monitoring**: Real-time performance metrics
- **Usage Analytics**: Team and feature usage statistics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Check the Firebase documentation
- **Issues**: Report bugs via GitHub Issues
- **Discussions**: Join community discussions
- **Email**: Contact support at support@taskprox.com

## 🔮 Roadmap

- [ ] File sharing and attachments
- [ ] Video/audio calls
- [ ] Mobile app (React Native)
- [ ] Advanced team permissions
- [ ] Integration with project management tools
- [ ] Advanced analytics and reporting
- [ ] Multi-language support
- [ ] Custom themes and branding

---

**Built with ❤️ using Next.js, Firebase, and Socket.IO**
