import SwiftUI

struct MenuContent: View {
    @Bindable var status: AppStatus
    @State private var portText = ""
    @State private var allowShell = Settings.allowShell
    // Inline confirm, not .confirmationDialog: presentation APIs are broken inside a .window MenuBarExtra.
    @State private var confirmingRevokeId: String?

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(spacing: 6) {
                Circle()
                    .fill(status.lastError != nil ? Color.red : status.serverRunning ? Color.green : Color.orange)
                    .frame(width: 8, height: 8)
                Text(status.serverRunning ? "Listening" : "Starting...")
            }
            .accessibilityElement(children: .combine)
            Text("PHONE CONNECTS TO").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            Text("\(status.boundHost):\(status.port)").font(.caption).monospaced().foregroundStyle(.secondary)
            if let error = status.lastError {
                Text(error).font(.caption2).foregroundStyle(.red).lineLimit(2)
            }

            HStack {
                Text("Port").font(.caption)
                TextField("port", text: $portText).frame(width: 70).accessibilityLabel("Port number")
                let parsed = UInt16(portText)
                let valid = parsed.map { (1024 ... 65535).contains($0) } ?? false
                Button(status.restarting ? "Restarting..." : "Apply") {
                    if let value = parsed, value != status.port { status.applyPort(value) }
                }
                .disabled(!valid || status.restarting)
                .buttonStyle(.bordered)
                .pointingHandCursor()
                .help("Restart the listener on this port")
                if !portText.isEmpty, parsed.map({ !(1024 ... 65535).contains($0) }) == true {
                    Text("1024-65535").font(.caption2).foregroundStyle(.red)
                }
            }
            .font(.caption)

            if let code = status.pairingCode {
                Divider()
                Text("PAIRING CODE").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                HStack {
                    Text(code).font(.system(.largeTitle, design: .monospaced)).fontWeight(.semibold).kerning(2)
                    Spacer()
                    Button {
                        let pasteboard = NSPasteboard.general
                        pasteboard.clearContents()
                        pasteboard.setString(code, forType: .string)
                    } label: {
                        Image(systemName: "doc.on.doc")
                    }
                    .buttonStyle(.borderless)
                    .pointingHandCursor()
                    .accessibilityLabel("Copy pairing code")
                    .help("Copy the pairing code")
                }
                HStack(spacing: 4) {
                    Text("Enter on your phone").font(.caption2).foregroundStyle(.secondary)
                    if let expiresAt = status.pairingExpiresAt, expiresAt > Date.now {
                        Text("- expires in").font(.caption2).foregroundStyle(.secondary)
                        Text(timerInterval: Date.now ... expiresAt, countsDown: true)
                            .font(.caption2).monospacedDigit().foregroundStyle(.secondary)
                    }
                }
            }

            if !status.accessibilityTrusted {
                Divider()
                HStack {
                    Label("Accessibility off", systemImage: "exclamationmark.triangle")
                        .foregroundStyle(.orange)
                    Spacer()
                    Button("Grant") { status.promptAccessibility() }
                        .buttonStyle(.bordered)
                        .pointingHandCursor()
                        .help("Open System Settings to grant Accessibility")
                }
                .font(.caption)
                Text("Needed for keystrokes, media keys, and Spaces. Launching apps and volume still work without it.")
                    .font(.caption2).foregroundStyle(.secondary).lineLimit(3)
            }

            Divider()
            Text("PAIRED DEVICES").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
            if status.pairedDevices.isEmpty {
                Text("No devices paired yet").font(.caption).foregroundStyle(.secondary)
            } else {
                ForEach(status.pairedDevices) { device in
                    HStack {
                        VStack(alignment: .leading, spacing: 1) {
                            Text(device.deviceName)
                            Text(device.pairedAt, format: .relative(presentation: .named))
                                .font(.caption2).foregroundStyle(.secondary)
                        }
                        Spacer()
                        if confirmingRevokeId == device.id {
                            Button("Cancel") { confirmingRevokeId = nil }
                                .buttonStyle(.borderless)
                                .pointingHandCursor()
                            Button("Confirm", role: .destructive) {
                                Task { await status.revoke(device.id); confirmingRevokeId = nil }
                            }
                            .buttonStyle(.borderless)
                            .pointingHandCursor()
                            .accessibilityLabel("Confirm revoke \(device.deviceName)")
                        } else {
                            Button("Revoke", role: .destructive) { confirmingRevokeId = device.id }
                                .buttonStyle(.borderless)
                                .pointingHandCursor()
                                .accessibilityLabel("Revoke \(device.deviceName)")
                                .help("Unpair this device and drop its connection")
                        }
                    }
                    .font(.caption)
                    .padding(.vertical, 3)
                    .hoverHighlight()
                }
            }

            Divider()
            Toggle("Open at login", isOn: Binding(
                get: { status.openAtLogin },
                set: { status.setOpenAtLogin($0) }
            ))
            .font(.caption)
            .toggleStyle(.checkbox)
            .pointingHandCursor()

            Toggle("Allow shell commands", isOn: $allowShell)
                .font(.caption)
                .toggleStyle(.checkbox)
                .pointingHandCursor()
                .onChange(of: allowShell) { _, newValue in Settings.allowShell = newValue }
                .help("Let buttons run arbitrary shell commands")
            if allowShell {
                Text("Runs arbitrary commands from paired devices. Restart the helper to update the app.")
                    .font(.caption2).foregroundStyle(.orange).lineLimit(3)
            }

            Divider()
            HStack {
                Text("LOGS").font(.caption2.weight(.semibold)).foregroundStyle(.secondary)
                Spacer()
                if !status.log.entries.isEmpty {
                    Button("Clear") { status.log.clear() }
                        .buttonStyle(.borderless).font(.caption)
                        .pointingHandCursor()
                        .help("Clear the log")
                }
            }
            if status.log.entries.isEmpty {
                Text("No issues").font(.caption2).foregroundStyle(.secondary)
            } else {
                ScrollView {
                    LazyVStack(alignment: .leading, spacing: 2) {
                        ForEach(status.log.entries.reversed()) { entry in
                            HStack(alignment: .firstTextBaseline) {
                                Text(entry.date, format: .dateTime.hour().minute().second())
                                    .font(.caption2).monospacedDigit().foregroundStyle(.secondary)
                                Text(entry.message)
                                    .font(.caption2).lineLimit(2)
                                    .foregroundStyle(entry.level == .error ? Color.red : Color.orange)
                            }
                        }
                    }
                }
                .frame(maxHeight: 120)
            }

            Divider()
            Button("Quit slate helper") { NSApplication.shared.terminate(nil) }
                .buttonStyle(.bordered)
                .keyboardShortcut("q")
                .pointingHandCursor()
                .help("Stop the helper and quit")
        }
        .padding(12)
        .frame(width: 280)
        .task {
            status.refreshAccessibility()
            status.refreshLoginItem()
            portText = String(status.port)
            allowShell = Settings.allowShell
        }
    }
}
