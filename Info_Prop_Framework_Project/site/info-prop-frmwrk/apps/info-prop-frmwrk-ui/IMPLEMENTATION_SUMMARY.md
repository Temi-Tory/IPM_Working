# Information Propagation Framework - Angular Implementation

## Overview

This Angular application provides a modern, service-based architecture for the Information Propagation Framework, replacing the previous static HTML/JavaScript implementation with a seamless, state-managed solution.

## Key Features Implemented

### 🏗️ Service Architecture
- **DataService**: Central state management for CSV files, network data, analysis results, and parameters
- **AnalysisService**: Handles all API calls to the Julia server (Tier 1, 2, 3 analyses)
- **FileService**: File upload, validation, and export functionality
- **LoadingService**: Global loading state management

### 📊 Three-Tier Analysis System
1. **Tier 1 - Structure Analysis**: Fast topology parsing and diamond identification
2. **Tier 2 - Diamond Analysis**: Enhanced diamond classification and structural analysis  
3. **Tier 3 - Full Analysis**: Complete belief propagation with probability calculations

### 🎨 Modern UI Components
- **Dashboard Component**: Main interface with file upload, parameter controls, and analysis options
- **Navigation Component**: Professional sidebar navigation with Material Design
- **Spinner Component**: Reusable loading indicators
- Responsive design with Angular Material

### 🔧 State Management
- Reactive state management using RxJS Observables
- No local/session storage needed - all state managed in services
- Seamless navigation between views with preserved state
- Parameter override system for individual node/edge customization

## File Structure

```
src/app/
├── services/
│   ├── data.service.ts           # Central state management
│   ├── analysis.service.ts       # API calls to Julia server
│   ├── file.service.ts          # File handling
│   └── loading.service.ts       # Loading states
├── pages/
│   └── dashboard/               # Main dashboard component
│       ├── dashboard.component.ts
│       ├── dashboard.component.html
│       └── dashboard.component.scss
├── layout/
│   ├── navigation/              # Sidebar navigation
│   └── spinner/                 # Loading spinner
└── app.config.ts               # App configuration with HttpClient
```

## Key Improvements Over Previous Implementation

### ✅ Better Architecture
- **Service-based**: Clean separation of concerns
- **Reactive**: Observable-based state management
- **Type-safe**: Full TypeScript implementation
- **Modular**: Reusable components and services

### ✅ Enhanced User Experience
- **Seamless navigation**: State preserved across views
- **Real-time updates**: Reactive UI updates
- **Better error handling**: Centralized error management
- **Professional UI**: Material Design components

### ✅ Maintainable Code
- **No global variables**: Everything managed through services
- **Clear data flow**: Unidirectional data flow with observables
- **Testable**: Injectable services for easy testing
- **Scalable**: Easy to add new features and components

## API Integration

The application connects to your existing Julia server at `http://localhost:8080/api` with these endpoints:

- `POST /api/parse-structure` - Tier 1 analysis
- `POST /api/analyze-diamond` - Tier 2 analysis  
- `POST /api/analyze-enhanced` - Tier 3 analysis
- `POST /api/analyze-diamond-subset` - Diamond subset analysis
- `POST /api/export-dot` - DOT format export

## Usage Flow

1. **Upload CSV**: Drag & drop or click to upload network file
2. **Configure Parameters**: Set node priors, edge probabilities, and options
3. **Choose Analysis**: Select from three analysis tiers
4. **View Results**: Navigate between structure, diamond, and results views
5. **Export**: Download results or DOT format

## State Management Benefits

### 🔄 Seamless Navigation
- Upload file once, use across all views
- Parameter changes persist across navigation
- Analysis results cached until new analysis run
- No need to re-upload or reconfigure when switching views

### 🎛️ Parameter Management
- Global parameter overrides (node priors, edge probabilities)
- Individual parameter customization (specific nodes/edges)
- Real-time parameter validation
- Parameter state preserved during navigation

### 📈 Analysis Workflow
- Progressive analysis tiers (can upgrade from Tier 1 → 2 → 3)
- Results cached for each tier
- No redundant API calls
- Clear analysis status and upgrade options

## Next Steps

### 🚀 To Run the Application
1. Ensure your Julia server is running on `http://localhost:8080`
2. Navigate to the Angular app directory
3. Run `npm install` to install dependencies
4. Run `ng serve` to start the development server
5. Open `http://localhost:4200` in your browser

### 🔧 Additional Components to Create
- **Results View Component**: Detailed results display with tables and charts
- **Visualization Component**: Network graph visualization using vis.js or D3
- **Diamond Analysis Component**: Detailed diamond structure analysis
- **Export Component**: Advanced export options and formats
