import Foundation

@main
enum HistoryTests {
    static func check(_ value: Bool) { assert(value) }
    static func main() throws {
        let root = FileManager.default.temporaryDirectory.appendingPathComponent("silverbank-history-test-" + UUID().uuidString)
        defer {
            do { try FileManager.default.removeItem(at: root) }
            catch { fputs("Could not remove native history test directory: \(error)\n", stderr) }
        }
        let scope = UUID().uuidString
        var store: WatchHistoryStore? = try WatchHistoryStore(scope: scope, directory: root)
        for index in 0..<601 {
            try store!.record(deviceId: "watch", deviceName: "Test watch", kind: "heart_rate", value: 72,
                              receivedAt: 946684800000 + Double(index) * 900000)
        }
        check(try store!.counts().total == 601)
        let first = try store!.page()
        assert(first.count == 200)
        let second = try store!.page(before: first.last!.sequence)
        assert(second.count == 200 && second.first!.sequence < first.last!.sequence)
        let oldest = try store!.page(before: 2)
        assert(oldest.first!.receivedAt == 946684800000)
        try store!.markUploaded([oldest.first!.id])
        check(try store!.counts().total == 601)
        check(try store!.counts().pending == 600)
        store = nil
        store = try WatchHistoryStore(scope: scope, directory: root)
        check(try store!.counts().total == 601)
        check(try store!.counts().pending == 600)
        let other = try WatchHistoryStore(scope: scope + "-other-account", directory: root)
        check(try other.counts().total == 0)
        let otherServer = try WatchHistoryStore(scope: scope + "-other-server", directory: root)
        check(try otherServer.counts().total == 0)
        let now = Date().timeIntervalSince1970 * 1000
        check(try store!.record(deviceId: "watch", deviceName: "Test watch", kind: "steps", value: 4200, receivedAt: now))
        check(try !store!.record(deviceId: "watch", deviceName: "Test watch", kind: "steps", value: 4201, receivedAt: now + 29999))
        check(try store!.record(deviceId: "watch", deviceName: "Test watch", kind: "steps", value: 4202, receivedAt: now + 30000))
        let onlySteps = try store!.page(pendingKinds: ["steps"])
        assert(onlySteps.count == 2 && onlySteps.allSatisfy { $0.kind == "steps" })
        do {
            try store!.record(deviceId: "watch", deviceName: "Test watch", kind: "heart_rate", value: 0, receivedAt: now)
            fatalError("Invalid heart rate was stored")
        } catch { assert(error.localizedDescription.contains("Invalid")) }
        try store!.deleteAll()
        check(try store!.counts().total == 0)
        print("PASS: durable all-age history, paging, 30-second sampling, category filtering, account/server isolation, acknowledgements without deletion, and explicit deletion")
    }
}
