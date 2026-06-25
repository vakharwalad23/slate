import ApplicationServices
import Foundation

// AXIsProcessTrusted reflects a mid-run Accessibility grant/revoke; the distributed notification lets us
// react immediately instead of waiting on the poll, which is only a backstop for the stale-cache edge cases.
@MainActor
final class AccessibilityMonitor {
    private var pollTask: Task<Void, Never>?
    private var observerTask: Task<Void, Never>?
    private let onChange: (Bool) -> Void

    init(onChange: @escaping (Bool) -> Void) {
        self.onChange = onChange
    }

    func start() {
        onChange(PermissionProbe.accessibilityGranted())
        pollTask = Task { [weak self] in
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(30))
                self?.onChange(PermissionProbe.accessibilityGranted())
            }
        }
        // "com.apple.accessibility.api" is the long-stable signal posted when any app's Accessibility trust
        // changes; it fires for every app, so we just re-read our own state.
        let name = Notification.Name("com.apple.accessibility.api")
        observerTask = Task { [weak self] in
            for await _ in DistributedNotificationCenter.default().notifications(named: name) {
                self?.onChange(PermissionProbe.accessibilityGranted())
            }
        }
    }

    func stop() {
        pollTask?.cancel()
        pollTask = nil
        observerTask?.cancel()
        observerTask = nil
    }
}
