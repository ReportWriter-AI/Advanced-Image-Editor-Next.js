# Advanced Image Editor

A modern, feature-rich image editor built with Next.js, TypeScript, and Tailwind CSS.

## Features

### Image Editing

- **Upload Images**: Drag & drop or click to browse images
- **Drawing Tools**: Freehand drawing with customizable colors and brush sizes
- **Arrow Tool**: Add arrows with custom colors
- **Crop Tool**: Crop images with resizable frames
- **Undo/Redo**: Full history management for all actions

### Voice Input

- **Microphone Button**: Located between location and submit buttons
- **Speech Recognition**: Automatically transcribes speech to description field
- **Real-time Feedback**: Visual indicators show when listening
- **Error Handling**: User-friendly error messages for common issues
- **Transcript Display**: Shows what was spoken with option to clear

### Location & Description

- **Location Selection**: Choose from predefined locations with search
- **Description Field**: Rich text area for image descriptions
- **Voice Input**: Speak to automatically fill the description

## How to Use Voice Input

1. **Click the Microphone Button**: Located between the location and submit buttons
2. **Allow Microphone Access**: Grant permission when prompted by your browser
3. **Start Speaking**: The button will turn green and show "Listening..." status
4. **Automatic Transcription**: Your speech will appear in the description field
5. **Stop Recording**: Click the button again to stop recording
6. **View Transcript**: See what was transcribed below the microphone button
7. **Clear Transcript**: Use the X button to clear the transcript if needed

### Browser Compatibility

- **Chrome/Edge**: Full support with WebKit Speech Recognition
- **Firefox**: Limited support (may require additional setup)
- **Safari**: Limited support on macOS
- **Mobile**: Works on mobile browsers with microphone access

### Troubleshooting

- **Microphone Not Working**: Check browser permissions and microphone connection
- **No Speech Detected**: Ensure you're speaking clearly and microphone is working
- **Permission Denied**: Allow microphone access in browser settings
- **Not Supported**: Upgrade to a modern browser that supports speech recognition

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
```

## PDF Report Generation

This project includes a server endpoint to generate PDF inspection reports from defects data.

- Endpoint: `POST /api/reports/generate`
- Body (JSON):
  - `defects`: Array of defect objects
  - `meta` (optional): `{ title, subtitle, company, logoUrl, date, startNumber }`

Example payload:

```
{
	"defects": [
		{
			"section": "Exterior",
			"subsection": "Siding, Flashing, & Trim",
			"defect_description": "Cracked siding observed at rear wall.",
			"image": "https://example.com/image.jpg",
			"location": "Rear of House",
			"material_total_cost": 250,
			"labor_type": "General Contractor",
			"labor_rate": 85,
			"hours_required": 3,
			"recommendation": "Repair cracked siding and reseal seams.",
			"color": "#d63636"
		}
	],
	"meta": { "title": "inspection-123-report", "company": "AGI Property Inspections" }
}
```

The inspection report page (`/inspection_report/[id]`) now includes a "Download PDF" button that posts the current view to this endpoint and downloads the resulting PDF.

Note: This endpoint uses Puppeteer and requires a Node.js runtime (already configured). If deploying to environments with sandbox restrictions, ensure `--no-sandbox` is allowed or use a compatible server environment.

## File Size Limits

### Image & Video Upload Limits
- **Maximum File Size**: 200MB per file
- **Supported Formats**: 
  - Images: JPEG, PNG, WebP, HEIC/HEIF (iPhone photos)
  - Videos: MP4, MOV, WebM, 3GP
- **360° Photos**: Supported up to 200MB
- **Warning Threshold**: 150MB (shows compression recommendation)

### Server Requirements
- **Vercel Pro Plan**: Required for files over 100MB
- **Vercel Hobby Plan**: Limited to 4.5MB (upgrade recommended)
- **Processing Time**: Up to 60 seconds for large files
- **HEIC Conversion**: Automatic conversion to JPEG for iPhone photos

### Optimization Tips
- Use TinyPNG or Squoosh for image compression
- Target under 10MB for best performance
- 360° photos: Compress to 8K resolution for optimal balance

## Technologies Used

- **Frontend**: Next.js 14, React 18, TypeScript
- **Styling**: Tailwind CSS, CSS3 animations
- **Speech Recognition**: WebKit Speech Recognition API
- **Icons**: Font Awesome 6
- **Build Tool**: Next.js build system

## Project Structure

```
image-editor/
├── components/          # React components
├── src/app/            # Next.js app directory
├── constants/          # App constants and colors
├── public/             # Static assets
└── styles/             # Global styles and CSS
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is open source and available under the MIT License.