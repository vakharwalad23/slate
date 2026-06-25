import AppKit
import SwiftUI

private struct PointingHandCursor: ViewModifier {
    func body(content: Content) -> some View {
        if #available(macOS 15.0, *) {
            content.pointerStyle(.link)
        } else {
            // set() is leak-proof; push()/pop() can strand the hand cursor if the menu closes mid-hover.
            content.onHover { inside in
                if inside { NSCursor.pointingHand.set() } else { NSCursor.arrow.set() }
            }
        }
    }
}

private struct HoverHighlight: ViewModifier {
    @State private var hovering = false
    var cornerRadius: CGFloat = 5

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Color.primary.opacity(hovering ? 0.08 : 0))
            )
            .contentShape(Rectangle())
            .onHover { hovering = $0 }
            .animation(.easeInOut(duration: 0.12), value: hovering)
    }
}

extension View {
    func pointingHandCursor() -> some View { modifier(PointingHandCursor()) }

    func hoverHighlight(cornerRadius: CGFloat = 5) -> some View {
        modifier(HoverHighlight(cornerRadius: cornerRadius))
    }
}
