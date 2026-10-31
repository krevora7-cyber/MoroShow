// Add this file to the iOS App target after `npx cap add ios`.
// NetShow remains a locally bundled installed app; video uses native AVKit.
import UIKit
import AVKit
import AVFoundation
import Capacitor

final class NetShowPlayerScreen: AVPlayerViewController {
    var onDismiss: (() -> Void)?
    private var notified = false

    override func viewDidDisappear(_ animated: Bool) {
        super.viewDidDisappear(animated)
        if isBeingDismissed || navigationController?.isBeingDismissed == true {
            if !notified {
                notified = true
                onDismiss?()
            }
        }
    }
}

@objc(NetShowNativePlayerPlugin)
public class NetShowNativePlayerPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NetShowNativePlayerPlugin"
    public let jsName = "NetShowNativePlayer"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "play", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "stop", returnType: CAPPluginReturnPromise)
    ]

    private var screen: NetShowPlayerScreen?
    private var timeObserver: Any?
    private var avPlayer: AVPlayer?

    private func cleanUp() {
        if let observer = timeObserver, let avPlayer = avPlayer { avPlayer.removeTimeObserver(observer) }
        timeObserver = nil
        avPlayer?.pause()
        avPlayer?.replaceCurrentItem(with: nil)
        avPlayer = nil
        screen = nil
    }

    @objc func play(_ call: CAPPluginCall) {
        guard let rawUrl = call.getString("url"), let url = URL(string: rawUrl),
              url.scheme?.lowercased() == "https" else {
            call.reject("Only secure HTTPS HLS/MP4 playback is supported on iPhone.")
            return
        }
        DispatchQueue.main.async { [weak self] in
            guard let self = self, let presenter = self.bridge?.viewController else {
                call.reject("NetShow player is not attached to a visible iOS view controller.")
                return
            }
            guard self.screen == nil else {
                call.reject("Close the current video before opening another.")
                return
            }
            do {
                try AVAudioSession.sharedInstance().setCategory(.playback, mode: .moviePlayback)
            } catch {
                // Some environments can play without changing the audio session.
            }
            let player = AVPlayer(url: url)
            let screen = NetShowPlayerScreen()
            screen.player = player
            screen.allowsPictureInPicturePlayback = true
            screen.showsPlaybackControls = true
            screen.modalPresentationStyle = .fullScreen
            self.screen = screen
            self.avPlayer = player
            let isLive = call.getBool("isLive") ?? false
            let startAt = max(0, call.getDouble("startAt") ?? 0)
            screen.onDismiss = { [weak self] in
                self?.notifyListeners("closed", data: [:])
                self?.cleanUp()
            }
            self.timeObserver = player.addPeriodicTimeObserver(forInterval: CMTime(seconds: 5, preferredTimescale: 600), queue: .main) { [weak self, weak player] time in
                guard let self = self, let player = player else { return }
                let duration = player.currentItem?.duration.seconds ?? 0
                let elapsed = time.seconds
                if !isLive && elapsed.isFinite && duration.isFinite && duration > 0 {
                    self.notifyListeners("progress", data: ["currentTime": elapsed, "duration": duration])
                }
            }
            presenter.present(screen, animated: true) {
                if !isLive && startAt > 0 {
                    player.seek(to: CMTime(seconds: startAt, preferredTimescale: 600), toleranceBefore: .zero, toleranceAfter: .zero)
                }
                player.play()
                call.resolve(["opened": true])
            }
        }
    }

    @objc func stop(_ call: CAPPluginCall) {
        DispatchQueue.main.async { [weak self] in
            guard let self = self else { call.resolve(); return }
            if let screen = self.screen {
                screen.dismiss(animated: true) {
                    self.cleanUp()
                    call.resolve()
                }
            } else {
                self.cleanUp()
                call.resolve()
            }
        }
    }
}
