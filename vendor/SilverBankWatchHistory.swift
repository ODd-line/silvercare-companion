import Foundation
import UIKit
import Capacitor
import CoreBluetooth

extension BluetoothLe {
    @objc func configureWatchHistory(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let scope = call.getString("scope"), let deviceId = call.getString("deviceId"),
                  let enabled = call.getBool("enabled") else {
                call.reject("Missing watch history permission or account."); return
            }
            do {
                if enabled {
                    guard self.watchHistoryContext == nil || self.watchHistoryContext?.scope == scope else {
                        throw WatchHistoryStore.failure("Disconnect the previous account's watch session first.")
                    }
                    let store = try WatchHistoryStore(scope: scope)
                    self.watchHistoryStore = store
                    self.watchHistoryContext = (scope, deviceId, call.getString("deviceName") ?? "PineTime")
                } else if self.watchHistoryContext?.scope == scope && self.watchHistoryContext?.deviceId == deviceId {
                    self.watchHistoryContext = nil
                    self.watchHistoryStore = nil
                }
                call.resolve()
            } catch { call.reject(error.localizedDescription) }
        }
    }

    @objc func readWatchHistory(_ call: CAPPluginCall) {
        guard let scope = call.getString("scope") else { call.reject("Missing history account."); return }
        do {
            let store = try WatchHistoryStore(scope: scope)
            let before = call.getInt("before").map { Int64($0) }
            let kinds = call.getArray("pendingKinds", String.self)
            let observations = try store.page(before: before, pendingKinds: kinds, limit: call.getInt("limit") ?? 200)
            let counts = try store.counts()
            var result: [String: Any] = ["records": observations.map { $0.dictionary },
                                        "total": counts.total, "pending": counts.pending]
            if let error = store.lastError { result["error"] = error }
            call.resolve(result)
        } catch { call.reject(error.localizedDescription) }
    }

    @objc func markWatchHistoryUploaded(_ call: CAPPluginCall) {
        guard let scope = call.getString("scope"), let ids = call.getArray("ids", String.self) else {
            call.reject("Missing history upload acknowledgement."); return
        }
        do {
            try WatchHistoryStore(scope: scope).markUploaded(ids)
            call.resolve()
        } catch { call.reject(error.localizedDescription) }
    }

    @objc func deleteWatchHistory(_ call: CAPPluginCall) {
        guard let scope = call.getString("scope"), call.getBool("confirmed") == true else {
            call.reject("Confirm deletion of this account's on-phone history."); return
        }
        do {
            try WatchHistoryStore(scope: scope).deleteAll()
            call.resolve()
        } catch { call.reject(error.localizedDescription) }
    }

    func saveWatchPacket(deviceId: String, characteristic: CBUUID, value: String, receivedAt: Double, notification: Bool) {
        guard let context = watchHistoryContext, context.deviceId == deviceId, let store = watchHistoryStore else { return }
        let isHeart = characteristic == CBUUID(string: "2A37")
        let isSteps = characteristic == CBUUID(string: "00030001-78FC-48FE-8E23-433B3A1942D0")
        guard (isHeart && notification) || isSteps else { return }
        do {
            guard value.count % 2 == 0, value.allSatisfy({ $0.isHexDigit }) else {
                throw WatchHistoryStore.failure("Invalid Bluetooth packet.")
            }
            let bytes = Array(stringToData(value))
            let measurement: Int
            if isHeart {
                guard (bytes.count == 2 && bytes[0] == 0) || (bytes.count == 3 && bytes[0] == 1) else {
                    throw WatchHistoryStore.failure("Unsupported watch heart-rate packet.")
                }
                measurement = Int(bytes[1]) + (bytes.count == 3 ? Int(bytes[2]) << 8 : 0)
                if measurement == 0 { return }
            } else {
                guard bytes.count == 4 else { throw WatchHistoryStore.failure("Invalid watch step-count packet.") }
                measurement = bytes.enumerated().reduce(0) { $0 | Int($1.element) << ($1.offset * 8) }
            }
            try store.record(deviceId: deviceId, deviceName: context.deviceName, kind: isHeart ? "heart_rate" : "steps",
                             value: measurement, receivedAt: receivedAt)
        } catch { store.reportFailure(error) }
    }
}
