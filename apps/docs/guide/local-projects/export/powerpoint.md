# PowerPoint (.pptx)

Export to PowerPoint creates a `.pptx` file from the current LocalStudio project.

## Use Cases

- Hand off to someone who needs PowerPoint.
- Archive a deck outside the LocalStudio folder.
- Move a deck into another presentation tool.

Export writes a standard OPC package: content types, relationships, and slide size follow the imported `pageSizePoints` when present. Image crops, custom clip paths, freeform lines, and video poster images are patched into DrawingML after the slide is generated. Mute, volume, trim, and video rotation are not preserved and produce export warnings.
