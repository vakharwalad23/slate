import ApplicationServices
import CoreGraphics

enum PermissionProbe {
    // The kAXTrustedCheckOptionPrompt global is a non-Sendable C var under strict concurrency; its
    // documented constant value is this literal.
    private static let promptOptionKey = "AXTrustedCheckOptionPrompt"

    // For the explicit Grant action: registers the app in the Accessibility list and prompts.
    @discardableResult
    static func promptAccessibility() -> Bool {
        AXIsProcessTrustedWithOptions([promptOptionKey: true] as CFDictionary)
    }

    // Live state read. AXIsProcessTrusted caches per-process and won't reflect a mid-run grant/revoke;
    // creating a listen-only event tap consults live TCC and is not cached, so it drives the reactive UI.
    static func accessibilityGranted() -> Bool {
        let mask = CGEventMask(1 << CGEventType.keyDown.rawValue)
        guard let tap = CGEvent.tapCreate(
            tap: .cgSessionEventTap,
            place: .headInsertEventTap,
            options: .listenOnly,
            eventsOfInterest: mask,
            callback: { _, _, event, _ in Unmanaged.passUnretained(event) },
            userInfo: nil
        ) else { return false }
        CFMachPortInvalidate(tap)
        return true
    }
}
