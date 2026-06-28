import ApplicationServices

enum PermissionProbe {
    // kAXTrustedCheckOptionPrompt is a non-Sendable C global under strict concurrency; this is its value.
    private static let promptOptionKey = "AXTrustedCheckOptionPrompt"

    // Shared by every command that synthesizes input (activate, keystroke, media keys, Spaces, app switch).
    static let notGrantedMessage =
        "accessibility not granted; enable slate helper in System Settings > Privacy and Security > Accessibility"

    // Explicit Grant action: registers the app in the Accessibility list and prompts.
    @discardableResult
    static func promptAccessibility() -> Bool {
        AXIsProcessTrustedWithOptions([promptOptionKey: true] as CFDictionary)
    }

    // Accessibility-only, non-prompting read; reflects a mid-run grant/revoke. Never touches Input Monitoring
    // (a listen-only CGEvent tap would, which is the wrong TCC service).
    static func accessibilityGranted() -> Bool {
        AXIsProcessTrusted()
    }
}
