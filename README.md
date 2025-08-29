# Unified Wishlist

A cross-platform wishlist application that allows users to save and track items from various online stores. The app fetches product information from URLs and provides a centralized place to manage your wishlist with price tracking capabilities.

## 🎥 Feature Demo

Click the preview below to watch the walkthrough video:

[![Watch the video](https://img.youtube.com/vi/OoZMDWybPdg/0.jpg)](https://www.youtube.com/watch?v=OoZMDWybPdg)

## Table of Contents

- [What is Unified Wishlist?](#what-is-unified-wishlist)
- [Why Use Unified Wishlist?](#why-use-unified-wishlist)
- [How Does It Work?](#how-does-it-work)
- [Project Structure](#project-structure)
- [Features](#features)
- [Architecture](#architecture)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
- [Development Workflow](#development-workflow)
- [API Endpoints](#api-endpoints)
- [Contributing](#contributing)
- [License](#license)

## What is Unified Wishlist?

Unified Wishlist is a full-stack application consisting of:

1. **Frontend**: A cross-platform mobile app built with Expo (React Native) that works on iOS, Android, and web
2. **Backend**: A Node.js/Express server that fetches product information from URLs

The app allows users to:
- Add items to their wishlist by providing URLs from online stores
- View product previews with titles, images, and prices
- Track items in a centralized wishlist
- Monitor progress toward a savings goal

## Why Use Unified Wishlist?

- **Cross-Platform**: Works on iOS, Android, and web browsers
- **Centralized Wishlist**: Keep all your desired items in one place instead of bookmarking pages across different stores
- **Price Tracking**: Automatically fetches current prices for items
- **Offline Storage**: Uses AsyncStorage for local data persistence

## How Does It Work?

1. **Add Items**: Users paste URLs of products they want to track
2. **Preview Generation**: The backend server fetches metadata from the URL to generate a preview
3. **Wishlist Storage**: Items are stored locally on the device using AsyncStorage
4. **Progress Tracking**: Users track their progress

## Project Structure

```
unified-wishlist/
├── preview/              # Expo frontend application
│   ├── app/              # App screens and routing
│   ├── components/       # Reusable UI components
│   ├── services/         # Business logic and API services
│   └── assets/           # Images and other static assets
├── server/               # Node.js backend server
│   └── server.ts         # Main server implementation
└── schemas/              # JSON schemas for data validation
```

## Features

### Frontend (Expo App)
- Cross-platform support (iOS, Android, Web)
- Tab-based navigation
- Wishlist management (add/remove items)
- Progress tracking toward savings goals
- URL deep linking support
- Responsive design
- Local data persistence with AsyncStorage

### Backend (Node.js Server)
- URL metadata extraction
- Rate limiting (10 requests per minute per IP)
- Support for major e-commerce sites (Amazon, Walmart, etc.)
- CORS support for frontend communication
- Error handling and validation

## Architecture

```
┌─────────────────┐    HTTP    ┌──────────────────┐
│   Expo Frontend │ ──────────▶ │  Node.js Server  │
│ (React Native)  │ ◀────────── │    (Express)     │
└─────────────────┘    JSON    └──────────────────┘
       │                              │
       ▼                              ▼
  AsyncStorage                 Product Metadata
  (Local Storage)              (Web Scraping)
```

The frontend communicates with the backend via HTTP POST requests to fetch product previews. All wishlist data is stored locally on the device.

## Getting Started

### Prerequisites

- Node.js (v20 or higher)
- npm
- For mobile development:
  - Expo CLI
  - Android Studio or Xcode for mobile emulation
- For web development:
  - Modern web browser

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/harshiteuro/Unified-Wishlist.git
   cd unified-wishlist
   ```

2. **Install server dependencies:**
   ```bash
   cd server
   npm install
   ```

3. **Install frontend dependencies:**
   ```bash
   cd ../preview
   npm install
   ```

### Running the Application

1. **Start the backend server:**
   ```bash
   cd server
   npm run dev
   ```
   The server will start on http://localhost:3000

2. **Start the frontend application:**
   ```bash
   cd preview
   npx expo start
   ```
   This will start the Expo development server.

3. **Open the app:**
   - **Mobile**: Scan the QR code with the Expo Go app
   - **Web**: Press `w` in the terminal or open http://localhost:8081

## Development Workflow

### Frontend Development

The frontend is organized with file-based routing in the `app/` directory:
- `app/(tabs)/wishlist.tsx` - Main wishlist screen
- `app/(tabs)/items.tsx` - Add items screen
- `app/(tabs)/about.tsx` - About screen

Key services:
- `services/dataService.ts` - Wishlist data management
- `services/previewService.ts` - Communication with backend server
- `services/urlUtils.ts` - URL normalization and utilities

### Backend Development

The backend server (`server/server.ts`) provides a single endpoint:
- `POST /preview` - Fetches metadata for a given URL

Key features:
- SSRF protection to prevent access to internal networks
- Rate limiting to prevent abuse
- Support for multiple e-commerce sites
- HTML size limiting for performance

## API Endpoints

### POST /preview

Fetches preview information for a URL.

**Request:**
```json
{
  "url": "http://walmart/x1/product"
}
```

**Response:**
```json
{
  "title": "Product Title",
  "image": "https://walmart.com/image.jpg",
  "price": "29.99",
  "currency": "USD",
  "siteName": "walmart.com",
  "sourceUrl": "https://walmart.com/product"
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

Please ensure your code follows the existing style and includes appropriate tests.