import SwiftUI

struct MenuContent: View {
    @Bindable var status: AppStatus

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(status.serverRunning ? "Listening" : "Starting...", systemImage: status.serverRunning ? "dot.radiowaves.left.and.right" : "hourglass")
            Text("\(status.boundHost):\(HelperConfig.port)").font(.caption).monospaced().foregroundStyle(.secondary)
            if let error = status.lastError {
                Text("Error: \(error)").font(.caption).foregroundStyle(.red)
            }

            if let code = status.pairingCode {
                Divider()
                Text("Pairing code").font(.caption).foregroundStyle(.secondary)
                Text(code).font(.title2).monospaced()
            }

            Divider()
            HStack {
                Label("Accessibility", systemImage: status.accessibilityTrusted ? "checkmark.circle" : "exclamationmark.triangle")
                    .foregroundStyle(status.accessibilityTrusted ? .green : .orange)
                Spacer()
                if !status.accessibilityTrusted {
                    Button("Grant") { status.promptAccessibility() }
                }
            }
            .font(.caption)

            Divider()
            Text("Paired devices").font(.caption).foregroundStyle(.secondary)
            if status.pairedDevices.isEmpty {
                Text("None yet").font(.caption).foregroundStyle(.secondary)
            } else {
                ForEach(status.pairedDevices) { device in
                    HStack {
                        Text(device.deviceName)
                        Spacer()
                        Button("Revoke") { Task { await status.revoke(device.id) } }
                            .buttonStyle(.borderless)
                    }
                    .font(.caption)
                }
            }

            Divider()
            Toggle("Open at login", isOn: Binding(
                get: { status.openAtLogin },
                set: { status.setOpenAtLogin($0) }
            ))
            .font(.caption)
            .toggleStyle(.checkbox)

            Divider()
            Button("Quit slate helper") { NSApplication.shared.terminate(nil) }
        }
        .padding(12)
        .frame(width: 260)
        .task {
            status.refreshAccessibility()
            status.refreshLoginItem()
        }
    }
}
