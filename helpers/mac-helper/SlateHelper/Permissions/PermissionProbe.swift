import ApplicationServices

enum PermissionProbe {
    // The kAXTrustedCheckOptionPrompt global is a non-Sendable C var under strict concurrency; its
    // documented constant value is this literal. prompt:false polls; prompt:true (explicit Grant) prompts.
    private static let promptOptionKey = "AXTrustedCheckOptionPrompt"

    static func accessibilityTrusted(prompt: Bool) -> Bool {
        AXIsProcessTrustedWithOptions([promptOptionKey: prompt] as CFDictionary)
    }
}
