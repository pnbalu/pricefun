# Pricefun Chat - WhatsApp-like App

A comprehensive WhatsApp-like chat application built with React Native Expo and Supabase, featuring real-time messaging, media sharing, and modern UI components.

## 🚀 Features

### Core Functionality
- ✅ **Phone Number Authentication** with OTP verification
- ✅ **Real-time Messaging** with Supabase Realtime
- ✅ **Media Support** - Images, Voice Messages, Video Messages
- ✅ **Profile Management** with photo upload and "About" section
- ✅ **Unread Message Counts** with automatic updates
- ✅ **Message Deletion** - Delete for me or delete for everyone
- ✅ **Multi-delete Functionality** for bulk message management

### UI/UX Features
- ✅ **Multi-theme Support** - Blue, Green, Orange themes
- ✅ **Enhanced Photo Selection** with camera and crop options
- ✅ **Modern UI** with clean React Native components
- ✅ **Responsive Design** with proper keyboard handling
- ✅ **Professional Styling** with shadows, gradients, and animations

### Technical Features
- ✅ **Secure Authentication** with Supabase Auth
- ✅ **Row Level Security** (RLS) policies
- ✅ **Optimistic UI Updates** for instant feedback
- ✅ **File Storage** with Supabase Storage
- ✅ **Database Optimization** with proper indexing

## 📋 Prerequisites

- **Node.js** 18+ 
- **Expo CLI** (`npm i -g expo`)
- **Supabase Account** and project
- **Mobile Device** or **Simulator** for testing

## 🛠️ Setup Instructions

### 1. Supabase Setup

1. **Create a Supabase project** at [supabase.com](https://supabase.com)
2. **Enable Phone Authentication:**
   - Go to Authentication → Settings
   - Enable Phone provider
   - Configure SMS provider (Twilio recommended)

### 2. Database Setup

1. **Run the complete setup script:**
   - Go to Supabase Dashboard → SQL Editor
   - Copy and paste the contents of `src/db/complete_setup.sql`
   - Execute the script

This will create:
- All database tables (profiles, chats, messages, etc.)
- Storage buckets for media files
- Row Level Security policies
- Helper functions

### 3. Environment Configuration

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=your_supabase_project_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Install Dependencies

```bash
npm install
```

### 5. Run the Application

```bash
# For iOS
npm run ios

# For Android  
npm run android

# For Web
npm run web
```

## 📱 App Structure

```
src/
├── screens/           # All app screens
│   ├── AuthScreen.js     # Phone authentication
│   ├── RegisterScreen.js # Profile setup
│   ├── UsersScreen.js    # User list with unread counts
│   ├── ChatsScreen.js    # Chat list
│   ├── ChatScreen.js     # Individual chat with media
│   ├── ProfileScreen.js  # Profile management
│   └── MenuScreen.js     # Settings and theme selection
├── navigation/        # Navigation setup
├── context/          # Theme context
├── lib/             # Supabase configuration
└── db/              # Database setup scripts
```

## 🎨 Themes

The app supports three beautiful themes:
- **Blue Theme** (Default) - Professional and clean
- **Green Theme** - Fresh and modern  
- **Orange Theme** - Warm and energetic

## 📸 Media Features

### Photo Sharing
- **Camera Capture** with built-in crop editor
- **Photo Library** selection with crop options
- **Square Aspect Ratio** for consistent display
- **High Quality** compression (80% quality)

### Voice Messages
- **Voice Recording** with waveform visualization
- **Playback Controls** with native audio
- **Duration Display** and recording timer
- **High Quality** audio recording

### Video Messages
- **Video Recording** (up to 60 seconds)
- **Video Library** selection
- **Native Video Player** with controls
- **Optimized Compression**

## 🔒 Security Features

- **Row Level Security** (RLS) on all tables
- **Secure File Storage** with proper access controls
- **Authenticated User Access** only
- **Phone Number Verification** required
- **Session Management** with secure storage

## 📊 Database Schema

### Core Tables
- `profiles` - User profiles with photos and about sections
- `chats` - Chat rooms (direct or group)
- `chat_participants` - Chat membership and read status
- `messages` - Messages with media support
- `message_hides` - Per-user message hiding

### Storage Buckets
- `chat-images` - Image messages (50MB limit)
- `chat-voice` - Voice messages (10MB limit)
- `chat-video` - Video messages (100MB limit)
- `profile-photos` - Profile pictures (10MB limit)

## 🚀 Deployment

### Expo Build
```bash
# Build for iOS
expo build:ios

# Build for Android
expo build:android

# Build for Web
expo build:web
```

### Environment Variables
Ensure all environment variables are set in your deployment platform.

## 📝 Notes

- **Phone numbers** must be in E.164 format (e.g., `+15555550123`)
- **Session persistence** via `expo-secure-store`
- **Real-time updates** use Supabase Realtime on `messages` table
- **File uploads** require proper storage bucket configuration
- **RLS policies** must be set up for security

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is open source and available under the MIT License.

## 🆘 Support

For issues and questions:
1. Check the Supabase documentation
2. Review the Expo documentation
3. Open an issue in this repository

---

**Built with ❤️ using React Native Expo and Supabase**
