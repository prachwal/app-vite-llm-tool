# Implementation Plan: Settings & Blobs Management

## Phase 1: Settings Page Enhancement 🎨
### 1.1 Theme Settings Component
- [ ] 1.1.1 Color tokens visualization
- [ ] 1.1.2 Theme mode selector (light/dark/system)
- [ ] 1.1.3 Color palette preview cards

### 1.2 Typography & Spacing Controls
- [ ] 1.2.1 Font size slider (12px-24px)
- [ ] 1.2.2 Line height control (1.2-2.0)
- [ ] 1.2.3 Spacing scale control (0.5x-2x)

### 1.3 LocalStorage Integration
- [ ] 1.3.1 Settings object structure design
- [ ] 1.3.2 Save/load settings to localStorage
- [ ] 1.3.3 Settings validation and migration

### 1.4 ThemeProvider Integration
- [ ] 1.4.1 Connect settings to ThemeProvider
- [ ] 1.4.2 Dynamic theme updates
- [ ] 1.4.3 Update existing tests

## Phase 2: Blobs Management Page 📁
### 2.1 Universal Confirmation Component
- [ ] 2.1.1 Modal confirmation dialog
- [ ] 2.1.2 Yes/No/Cancel options
- [ ] 2.1.3 Customizable messages and actions

### 2.2 Container Management
- [ ] 2.2.1 Dropdown container selector
- [ ] 2.2.2 Add new container functionality
- [ ] 2.2.3 Delete container with confirmation

### 2.3 File Browser (Norton Commander Style)
- [ ] 2.3.1 Left panel: File list component
- [ ] 2.3.2 File selection and navigation
- [ ] 2.3.3 File operations (upload, delete, rename)

### 2.4 Preview Panel
- [ ] 2.4.1 Right panel: File preview
- [ ] 2.4.2 Support for different file types
- [ ] 2.4.3 Metadata display

### 2.5 API Integration
- [ ] 2.5.1 Connect to Netlify Blobs API
- [ ] 2.5.2 Error handling and loading states
- [ ] 2.5.3 Real-time updates

## Phase 3: Testing & Documentation 🧪
### 3.1 Component Tests
- [ ] 3.1.1 Settings components tests
- [ ] 3.1.2 Blobs components tests
- [ ] 3.1.3 Integration tests

### 3.2 Documentation
- [ ] 3.2.1 Component documentation
- [ ] 3.2.2 Usage examples
- [ ] 3.2.3 API documentation

## Technical Stack
- **UI Framework**: Material-UI with Preact
- **State Management**: Preact Signals
- **Storage**: localStorage with JSON objects
- **API**: Netlify Blobs (existing endpoints)
- **Testing**: Existing test infrastructure
- **Routing**: Preact Router (if needed)

## File Structure
```
src/
├── components/
│   ├── settings/
│   │   ├── ThemeSettings.tsx
│   │   ├── TypographySettings.tsx
│   │   └── ColorTokens.tsx
│   ├── blobs/
│   │   ├── BlobsContainer.tsx
│   │   ├── FileList.tsx
│   │   ├── FilePreview.tsx
│   │   └── ContainerSelector.tsx
│   └── common/
│       └── ConfirmationDialog.tsx
├── services/
│   ├── settingsService.ts
│   └── blobsService.ts
├── hooks/
│   ├── useSettings.ts
│   └── useBlobs.ts
└── pages/
    ├── Settings.tsx (enhanced)
    └── Blobs.tsx (new)
```

## Implementation Priority
1. **High**: Settings enhancement (immediate user value)
2. **High**: Universal confirmation component (reusable)
3. **Medium**: Blobs page structure and API integration
4. **Medium**: File browser functionality
5. **Low**: Advanced preview features
