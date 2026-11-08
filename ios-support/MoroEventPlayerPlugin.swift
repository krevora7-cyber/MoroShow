import UIKit
import WebKit
import AVFoundation
import Capacitor

// Event pages are isolated from the app's Capacitor bridge and account data.
private func allowedEventURL(_ url: URL) -> Bool {
    guard url.scheme?.lowercased() == "https", url.user == nil, url.password == nil,
          url.port == nil || url.port == 443, let host = url.host?.lowercased() else { return false }
    return (host == "goo4goalz.com" && url.path == "/ch.html") ||
        (host == "redirectus.net" && ["/streame.html", "/streamlat.html"].contains(url.path))
}

private final class MoroEventScreen: UIViewController, WKNavigationDelegate, WKUIDelegate {
    var eventURL: URL!
    var onClose: (() -> Void)?
    private var web: WKWebView?
    private var closed = false
    private let status = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        let stack = UIStackView()
        stack.axis = .vertical
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)
        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            stack.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            stack.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            stack.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.bottomAnchor)
        ])
        let bar = UIStackView()
        bar.spacing = 12
        bar.alignment = .center
        bar.layoutMargins = UIEdgeInsets(top: 4, left: 12, bottom: 4, right: 12)
        bar.isLayoutMarginsRelativeArrangement = true
        let back = UIButton(type: .system)
        back.setTitle("Back", for: .normal)
        back.addTarget(self, action: #selector(closePlayer), for: .touchUpInside)
        bar.addArrangedSubview(back)
        status.text = title
        status.textColor = .white
        status.numberOfLines = 1
        status.lineBreakMode = .byTruncatingTail
        status.setContentCompressionResistancePriority(.defaultLow, for: .horizontal)
        bar.addArrangedSubview(status)
        let reload = UIButton(type: .system)
        reload.setTitle("Reload", for: .normal)
        reload.addTarget(self, action: #selector(reloadPlayer), for: .touchUpInside)
        bar.addArrangedSubview(reload)
        bar.heightAnchor.constraint(greaterThanOrEqualToConstant: 52).isActive = true
        stack.addArrangedSubview(bar)
        let config = WKWebViewConfiguration()
        config.allowsInlineMediaPlayback = true
        config.allowsPictureInPictureMediaPlayback = true
        config.mediaTypesRequiringUserActionForPlayback = .all
        config.websiteDataStore = .nonPersistent()
        let player = WKWebView(frame: .zero, configuration: config)
        web = player
        player.navigationDelegate = self
        player.uiDelegate = self
        player.isOpaque = false
        player.backgroundColor = .black
        stack.addArrangedSubview(player)
        player.load(URLRequest(url: eventURL))
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
    }
    @objc private func reloadPlayer() { status.text = title; web?.reload() }
    @objc private func closePlayer() { dismiss(animated: true) { self.finish() } }
    func finish() {
        guard !closed else { return }
        closed = true
        web?.stopLoading()
        web?.navigationDelegate = nil
        web?.uiDelegate = nil
        web?.removeFromSuperview()
        web = nil
        onClose?()
        onClose = nil
    }
    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed { finish() }
    }
    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for navigationAction: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? { nil }
    func webView(_ webView: WKWebView, decidePolicyFor navigationAction: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let frame = navigationAction.targetFrame else { decisionHandler(.cancel); return }
        if frame.isMainFrame {
            guard let url = navigationAction.request.url, allowedEventURL(url) else { decisionHandler(.cancel); return }
        }
        decisionHandler(.allow)
    }
    func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
        if (error as NSError).code != NSURLErrorCancelled { status.text = "Source unavailable. Go back and try another." }
    }
}

@objc(MoroEventPlayerPlugin)
public class MoroEventPlayerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "MoroEventPlayerPlugin"
    public let jsName = "MoroEventPlayer"
    public let pluginMethods: [CAPPluginMethod] = [CAPPluginMethod(name: "open", returnType: CAPPluginReturnPromise)]
    private var screen: MoroEventScreen?
    @objc func open(_ call: CAPPluginCall) {
        guard let raw = call.getString("url"), let url = URL(string: raw), allowedEventURL(url) else {
            call.reject("Unsupported event source."); return
        }
        let title = String((call.getString("title") ?? "Event").prefix(120))
        DispatchQueue.main.async {
            guard self.screen == nil else { call.reject("Close the current player first."); return }
            guard let presenter = self.bridge?.viewController, presenter.presentedViewController == nil else {
                call.reject("Player cannot be presented right now."); return
            }
            let screen = MoroEventScreen()
            screen.title = title
            screen.eventURL = url
            screen.modalPresentationStyle = .fullScreen
            screen.onClose = { [weak self] in self?.screen = nil; call.resolve(["closed": true]) }
            self.screen = screen
            presenter.present(screen, animated: true)
        }
    }
}
