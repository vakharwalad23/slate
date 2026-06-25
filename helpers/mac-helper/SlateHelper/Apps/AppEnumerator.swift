import Foundation

enum AppEnumerator {
    // User-facing dirs first so a user-installed copy shadows a system one (first bundleId wins).
    private static let searchRoots: [URL] = [
        URL(filePath: "/Applications"),
        FileManager.default.homeDirectoryForCurrentUser.appending(path: "Applications"),
        URL(filePath: "/System/Applications"),
        URL(filePath: "/System/Applications/Utilities"),
    ]

    static func enumerate() -> [AppInfo] {
        let fileManager = FileManager.default
        var seen = Set<String>()
        var apps: [AppInfo] = []
        for root in searchRoots {
            guard let entries = try? fileManager.contentsOfDirectory(
                at: root,
                includingPropertiesForKeys: [.contentModificationDateKey],
                options: [.skipsHiddenFiles]
            ) else { continue }
            for url in entries where url.pathExtension == "app" {
                guard let info = appInfo(at: url), seen.insert(info.bundleId).inserted else { continue }
                apps.append(info)
            }
        }
        return apps.sorted { $0.name.localizedCaseInsensitiveCompare($1.name) == .orderedAscending }
    }

    private static func appInfo(at url: URL) -> AppInfo? {
        guard let bundle = Bundle(url: url), let bundleId = bundle.bundleIdentifier else { return nil }
        let name = (bundle.object(forInfoDictionaryKey: "CFBundleDisplayName") as? String)
            ?? (bundle.object(forInfoDictionaryKey: "CFBundleName") as? String)
            ?? url.deletingPathExtension().lastPathComponent
        // iconVersion = bundle mtime (seconds) -> the phone's cache key changes only on app update.
        let modified = (try? url.resourceValues(forKeys: [.contentModificationDateKey]))?.contentModificationDate ?? .distantPast
        let iconVersion = String(Int(modified.timeIntervalSince1970))
        return AppInfo(bundleId: bundleId, name: name, path: url.path(percentEncoded: false), iconVersion: iconVersion)
    }
}
