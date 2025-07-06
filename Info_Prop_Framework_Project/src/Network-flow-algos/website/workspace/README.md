# Network Flow Analysis Application

A comprehensive Angular 20 application for network analysis, featuring advanced algorithms for reachability analysis, diamond classification, and Monte Carlo simulations on directed acyclic graphs (DAGs).

## 🚀 Features

### Core Functionality
- **Network Upload & Validation**: Support for various network file formats with comprehensive validation
- **Interactive Network Visualization**: Powered by Sigma.js for high-performance graph rendering
- **Diamond Node Classification**: Automatic classification of nodes as sources, sinks, intermediates, or isolated
- **Reachability Analysis**: Path enumeration and probability calculations between node sets
- **Monte Carlo Simulation**: Statistical validation of network analysis results
- **Multi-format Probability Support**: Float, interval, and P-box probability representations

### Technical Features
- **Angular 20**: Latest Angular framework with standalone components
- **NX Workspace**: Monorepo structure with shared libraries
- **TypeScript**: Full type safety and modern JavaScript features
- **Reactive Architecture**: RxJS-based state management
- **Material Design**: Angular Material UI components
- **Chart.js Integration**: Advanced data visualization capabilities
- **Session Management**: Persistent workflow state across browser sessions

## 📋 Prerequisites

- **Node.js**: Version 18.x or higher
- **npm**: Version 9.x or higher
- **Julia**: Version 1.9+ (for backend server)

## 🛠️ Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd network-flow-analysis
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the shared library**
   ```bash
   npm run build:lib
   ```

## 🚀 Development Workflow

### Starting the Development Server

```bash
# Start the Angular development server
npm start

# Or with specific configuration
npm run dev
```

The application will be available at `http://localhost:4200`

### Building for Production

```bash
# Production build
npm run build:prod

# Serve static files
npm run serve:static
```

### Linting and Code Quality

```bash
# Run ESLint
npm run lint

# Format code with Prettier
npx prettier --write .
```

## 🏗️ Project Architecture

### Workspace Structure

```
workspace/
├── apps/
│   └── network-flow-ui/          # Main Angular application
│       ├── src/
│       │   ├── app/
│       │   │   ├── pages/         # Feature pages/components
│       │   │   ├── app.config.ts  # Application configuration
│       │   │   └── app.routes.ts  # Routing configuration
│       │   └── main.ts            # Application bootstrap
│       └── project.json           # NX project configuration
├── libs/
│   └── network-core/              # Shared library
│       ├── src/
│       │   ├── lib/
│       │   │   ├── components/    # Reusable UI components
│       │   │   ├── services/      # Business logic services
│       │   │   ├── models/        # TypeScript interfaces
│       │   │   ├── guards/        # Route guards
│       │   │   ├── utils/         # Utility functions
│       │   │   └── pipes/         # Custom pipes
│       │   └── index.ts           # Public API exports
│       └── project.json
└── package.json                   # Root package configuration
```

### Component Architecture

#### Core Components
- **LoadingSpinnerComponent**: Reusable loading indicator with overlay support
- **ErrorDisplayComponent**: Comprehensive error display with retry functionality
- **ChartComponent**: Chart.js wrapper for data visualization

#### Page Components
- **NetworkUploadComponent**: File upload and network configuration
- **NetworkDetailsComponent**: Network structure visualization and statistics
- **DiamondAnalysisComponent**: Node classification results
- **ReachabilityAnalysisComponent**: Path analysis and probability calculations
- **MonteCarloComponent**: Simulation configuration and results
- **ResultsComponent**: Comprehensive analysis summary

### Services Architecture

#### Core Services
- **GlobalStateService**: Application-wide state management
- **NetworkAnalysisService**: API communication and data processing
- **SessionStorageService**: Persistent session management

#### Workflow Management
- **WorkflowGuard**: Route protection based on workflow completion
- **WorkflowState**: Step-by-step process validation

## 🔌 API Integration

### Backend Server

The application communicates with a Julia-based backend server that provides:

- **Network Processing**: File upload and graph construction
- **Diamond Classification**: Node categorization algorithms
- **Reachability Analysis**: Path enumeration and probability calculation
- **Monte Carlo Simulation**: Statistical validation methods

### API Endpoints

```typescript
// Network upload
POST /api/upload-network
Content-Type: multipart/form-data

// Diamond analysis
POST /api/diamond-analysis
GET /api/diamond-analysis/:sessionId

// Reachability analysis
POST /api/reachability-analysis
GET /api/reachability-results/:sessionId

// Monte Carlo simulation
POST /api/monte-carlo
GET /api/monte-carlo-results/:sessionId
```

### Data Models

The application uses comprehensive TypeScript interfaces for type safety:

- **NetworkGraph**: Core network structure
- **DiamondAnalysisResult**: Node classification results
- **ReachabilityResult**: Path analysis outcomes
- **MonteCarloResult**: Simulation statistics

## 🎯 Usage Guide

### 1. Network Upload
1. Navigate to the Network Setup page
2. Select your network file (.edge format)
3. Choose probability type (float, interval, or P-box)
4. Upload optional node priors and link probabilities
5. Submit for processing

### 2. Network Structure Review
1. View the uploaded network visualization
2. Examine network statistics and properties
3. Verify node and edge counts
4. Proceed to analysis steps

### 3. Diamond Analysis
1. Run automatic node classification
2. Review source, sink, intermediate, and isolated nodes
3. Examine connectivity patterns
4. Export classification results

### 4. Reachability Analysis
1. Select source and target node sets
2. Configure analysis parameters
3. Run path enumeration
4. Review probability calculations and path details

### 5. Monte Carlo Validation
1. Configure simulation parameters
2. Set iteration count and convergence criteria
3. Run statistical validation
4. Compare with analytical results

### 6. Results Summary
1. View comprehensive analysis summary
2. Export results in various formats
3. Generate analysis reports
4. Save session for future reference

## 🧪 Testing

### Unit Testing
```bash
# Run unit tests (when configured)
npm test
```

### End-to-End Testing
```bash
# Run e2e tests (when configured)
npm run e2e
```

## 📦 Dependencies

### Core Dependencies
- **@angular/core**: ^20.0.0 - Angular framework
- **@angular/material**: ^20.0.5 - Material Design components
- **sigma**: ^3.0.2 - Network visualization
- **chart.js**: ^4.4.1 - Data visualization
- **d3**: ^7.9.0 - Data manipulation and visualization
- **rxjs**: ~7.8.0 - Reactive programming

### Development Dependencies
- **@nx/angular**: 21.2.2 - NX Angular support
- **typescript**: ~5.8.2 - TypeScript compiler
- **eslint**: ^9.8.0 - Code linting
- **prettier**: ^2.6.2 - Code formatting

## 🚀 Deployment

### Production Build
```bash
npm run build:prod
```

### Docker Deployment (Optional)
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist/ ./dist/
EXPOSE 4200
CMD ["npm", "run", "serve:static"]
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Code Style
- Follow Angular style guide
- Use TypeScript strict mode
- Maintain test coverage
- Document public APIs

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Create an issue in the repository
- Check the documentation
- Review the API integration guide

## 🔄 Version History

- **v1.0.0**: Initial release with core functionality
- **v1.1.0**: Enhanced visualization and performance improvements
- **v1.2.0**: Added Monte Carlo simulation support
- **v2.0.0**: Angular 20 upgrade and architecture improvements

---

Built with ❤️ using Angular 20 and modern web technologies.
