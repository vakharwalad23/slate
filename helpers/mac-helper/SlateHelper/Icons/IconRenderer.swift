import AppKit

enum IconRenderer {
    // 256px matches the protocol contract + the phone cache. NSWorkspace composites the icon the user
    // actually sees (reads Assets.car/Icon Composer output, masks, falls back to .icns), which is why we
    // do not parse bundle resources ourselves. autoreleasepool keeps a batch render from piling up NSImages.
    static func pngBase64(forBundlePath path: String, pixels: Int = 256) -> String? {
        autoreleasepool {
            let icon = NSWorkspace.shared.icon(forFile: path)
            guard let rep = NSBitmapImageRep(
                bitmapDataPlanes: nil,
                pixelsWide: pixels, pixelsHigh: pixels,
                bitsPerSample: 8, samplesPerPixel: 4,
                hasAlpha: true, isPlanar: false,
                colorSpaceName: .deviceRGB,
                bytesPerRow: 0, bitsPerPixel: 0
            ) else { return nil }
            rep.size = NSSize(width: pixels, height: pixels)

            guard let context = NSGraphicsContext(bitmapImageRep: rep) else { return nil }
            let previous = NSGraphicsContext.current
            NSGraphicsContext.current = context
            defer { NSGraphicsContext.current = previous }

            icon.draw(in: NSRect(x: 0, y: 0, width: pixels, height: pixels), from: .zero, operation: .copy, fraction: 1.0)
            context.flushGraphics()

            return rep.representation(using: .png, properties: [:])?.base64EncodedString()
        }
    }
}
