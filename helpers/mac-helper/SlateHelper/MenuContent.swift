import SwiftUI

struct MenuContent: View {
    @Bindable var status: AppStatus
    @State private var portText = ""

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label(status.serverRunning ? "Listening" : "Starting...", systemImage: status.serverRunning ? "dot.radiowaves.left.and.right" : "hourglass")
            Text("\(status.boundHost):\(status.port)").font(.caption).monospaced().foregroundStyle(.secondary)
            HStack {
                Text("Port").font(.caption)
                TextField("port", text: $portText).frame(width: 70)
                Button("Apply") {
                    if let value = UInt16(portText), value != status.port { status.applyPort(value) }
                }
                .disabled(UInt16(portText) == nil)
            }
            .font(.caption)
            if let error = status.lastError {
                Text("Error: \(error)").font(.caption).foregroundStyle(.red)
            }

            if let code = status.pairingCode {
                Divider()
                Text("Pairing code").font(.caption).foregroundStyle(.secondary)
                Text(code).font(.title2).monospaced()
            }

            if !status.accessibilityTrusted {
                Divider()
                HStack {
                    Label("Accessibility off", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Spacer()
                    Button("Grant") { status.promptAccessibility() }
                }
                .font(.caption)
            }

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
            HStack {
                Text("Logs").font(.caption).foregroundStyle(.secondary)
                Spacer()
                if !status.log.entries.isEmpty {
                    Button("Clear") { status.log.clear() }.buttonStyle(.borderless).font(.caption)
                }
            }
            if status.log.entries.isEmpty {
                Text("No warnings or errors").font(.caption2).foregroundStyle(.secondary)
            } else {
                ForEach(status.log.entries.suffix(6).reversed()) { entry in
                    Text(entry.message)
                        .font(.caption2)
                        .lineLimit(2)
                        .foregroundStyle(entry.level == .error ? .red : .orange)
                }
            }

            Divider()
            Button("Quit slate helper") { NSApplication.shared.terminate(nil) }
        }
        .padding(12)
        .frame(width: 260)
        .task {
            status.refreshAccessibility()
            status.refreshLoginItem()
            portText = String(status.port)
        }
    }
}
