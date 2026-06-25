import Foundation

// Caches the last enumeration so apps.icon can resolve a bundleId -> path without re-scanning.
// Enumeration runs off the actor (detached) so the dir scan never blocks message handling.
actor AppCatalog {
    private var byBundleId: [String: AppInfo] = [:]

    @discardableResult
    func refresh() async -> [AppInfo] {
        let apps = await Task.detached { AppEnumerator.enumerate() }.value
        byBundleId = Dictionary(apps.map { ($0.bundleId, $0) }, uniquingKeysWith: { first, _ in first })
        return apps
    }

    func info(for bundleId: String) async -> AppInfo? {
        if let cached = byBundleId[bundleId] { return cached }
        await refresh()
        return byBundleId[bundleId]
    }
}
