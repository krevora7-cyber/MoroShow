import UIKit
import Capacitor

@objc(NetShowBridgeViewController)
class NetShowBridgeViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(NetShowNativePlayerPlugin())
        bridge?.registerPluginInstance(MoroProtectedPlayerPlugin())
    }
}
