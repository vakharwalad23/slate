import Foundation

// Polls the live Accessibility state so the menu reacts to a grant/revoke without restarting (the
// state is not observable and AXIsProcessTrusted caches, so a short poll is the reliable approach).
@MainActor
final class AccessibilityMonitor {
    private var task: Task<Void, Never>?
    private let onChange: (Bool) -> Void

    init(onChange: @escaping (Bool) -> Void) {
        self.onChange = onChange
    }

    func start() {
        task = Task { [weak self] in
            while !Task.isCancelled {
                self?.onChange(PermissionProbe.accessibilityGranted())
                try? await Task.sleep(for: .seconds(2))
            }
        }
    }

    func stop() {
        task?.cancel()
        task = nil
    }
}
