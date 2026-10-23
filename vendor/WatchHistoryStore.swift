import Foundation
import CryptoKit
import SQLite3

final class WatchHistoryStore {
    struct Observation {
        let sequence: Int64
        let id: String
        let deviceId: String
        let deviceName: String
        let kind: String
        let value: Int
        let receivedAt: Double
        let uploaded: Bool

        var dictionary: [String: Any] {
            ["sequence": sequence, "id": id, "deviceId": deviceId, "deviceName": deviceName,
             "kind": kind, "value": value, "receivedAt": receivedAt, "uploaded": uploaded]
        }
    }

    enum Value {
        case text(String), integer(Int64), number(Double)
    }

    private var database: OpaquePointer?
    private let errorKey: String
    var lastError: String? { UserDefaults.standard.string(forKey: errorKey) }

    init(scope: String, directory: URL? = nil) throws {
        guard !scope.isEmpty, scope.utf8.count <= 2048 else {
            throw Self.failure("Invalid private history account.")
        }
        let digest = SHA256.hash(data: Data(scope.utf8)).map { String(format: "%02x", $0) }.joined()
        errorKey = "silverbank-watch-history-error-" + digest
        var root = try directory ?? FileManager.default.url(for: .applicationSupportDirectory,
            in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("WatchHistory", isDirectory: true)
        try FileManager.default.createDirectory(at: root, withIntermediateDirectories: true)
        #if os(iOS)
        try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                                              ofItemAtPath: root.path)
        #endif
        var resources = URLResourceValues()
        resources.isExcludedFromBackup = true
        try root.setResourceValues(resources)
        let file = root.appendingPathComponent(digest + ".sqlite3")
        guard sqlite3_open_v2(file.path, &database, SQLITE_OPEN_CREATE | SQLITE_OPEN_READWRITE | SQLITE_OPEN_FULLMUTEX, nil) == SQLITE_OK else {
            if let database { sqlite3_close(database) }
            database = nil
            throw Self.failure("Could not open private watch history.")
        }
        do {
            #if os(iOS)
            try FileManager.default.setAttributes([.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication],
                                                  ofItemAtPath: file.path)
            #endif
            sqlite3_busy_timeout(database, 3000)
            _ = try scalar("PRAGMA secure_delete=ON")
            let version = try scalar("PRAGMA user_version")
            guard version == 0 || version == 1 else { throw Self.failure("Unsupported watch history format.") }
            try execute("""
                CREATE TABLE IF NOT EXISTS observations(
                  sequence INTEGER PRIMARY KEY AUTOINCREMENT,
                  id TEXT NOT NULL UNIQUE,
                  device_id TEXT NOT NULL,
                  device_name TEXT NOT NULL,
                  kind TEXT NOT NULL CHECK(kind IN ('heart_rate','steps')),
                  value INTEGER NOT NULL,
                  received_at REAL NOT NULL,
                  uploaded INTEGER NOT NULL DEFAULT 0 CHECK(uploaded IN (0,1))
                )
                """)
            try execute("CREATE INDEX IF NOT EXISTS watch_sample ON observations(device_id,kind,received_at)")
            try execute("CREATE INDEX IF NOT EXISTS watch_pending ON observations(uploaded,kind,sequence)")
            if version == 0 { try execute("PRAGMA user_version=1") }
        } catch {
            sqlite3_close(database)
            database = nil
            throw error
        }
    }

    deinit { if let database { sqlite3_close(database) } }

    static func failure(_ message: String) -> NSError {
        NSError(domain: "SilverBankWatchHistory", code: 1, userInfo: [NSLocalizedDescriptionKey: message])
    }

    private func statement<T>(_ sql: String, _ values: [Value] = [], body: (OpaquePointer) throws -> T) throws -> T {
        var prepared: OpaquePointer?
        guard sqlite3_prepare_v2(database, sql, -1, &prepared, nil) == SQLITE_OK, let prepared else {
            throw Self.failure("Could not prepare private history operation.")
        }
        defer { sqlite3_finalize(prepared) }
        for (index, value) in values.enumerated() {
            let position = Int32(index + 1)
            let result: Int32
            switch value {
            case .text(let text):
                result = text.withCString { sqlite3_bind_text(prepared, position, $0, -1, unsafeBitCast(-1, to: sqlite3_destructor_type.self)) }
            case .integer(let number): result = sqlite3_bind_int64(prepared, position, number)
            case .number(let number): result = sqlite3_bind_double(prepared, position, number)
            }
            guard result == SQLITE_OK else { throw Self.failure("Could not bind private history values.") }
        }
        return try body(prepared)
    }

    private func execute(_ sql: String, _ values: [Value] = []) throws {
        try statement(sql, values) {
            guard sqlite3_step($0) == SQLITE_DONE else {
                throw Self.failure("Could not save private history. Check available iPhone storage.")
            }
        }
    }

    private func scalar(_ sql: String, _ values: [Value] = []) throws -> Int64 {
        try statement(sql, values) {
            guard sqlite3_step($0) == SQLITE_ROW else { throw Self.failure("Could not read private history count.") }
            return sqlite3_column_int64($0, 0)
        }
    }

    @discardableResult
    func record(deviceId: String, deviceName: String, kind: String, value: Int, receivedAt: Double) throws -> Bool {
        guard !deviceId.isEmpty, deviceId.count <= 200, deviceName.count <= 200,
              receivedAt.isFinite, receivedAt > 0,
              (kind == "heart_rate" && (1...300).contains(value)) ||
                (kind == "steps" && (0...200000).contains(value)) else {
            throw Self.failure("Invalid watch history observation.")
        }
        let last = try statement("SELECT MAX(received_at) FROM observations WHERE device_id=? AND kind=?",
                                 [.text(deviceId), .text(kind)]) { row -> Double? in
            guard sqlite3_step(row) == SQLITE_ROW else { throw Self.failure("Could not check watch sampling time.") }
            return sqlite3_column_type(row, 0) == SQLITE_NULL ? nil : sqlite3_column_double(row, 0)
        }
        if let last {
            guard receivedAt >= last else { throw Self.failure("Phone time moved backwards; check the date and time before recording more readings.") }
            if receivedAt - last < 30000 { return false }
        }
        try execute("INSERT INTO observations(id,device_id,device_name,kind,value,received_at) VALUES(?,?,?,?,?,?)",
                    [.text("sb-local:" + UUID().uuidString.lowercased()), .text(deviceId), .text(deviceName),
                     .text(kind), .integer(Int64(value)), .number(receivedAt)])
        return true
    }

    func reportFailure(_ error: Error) {
        let message = "Some watch readings could not be saved on this phone. " + error.localizedDescription
        UserDefaults.standard.set(message, forKey: errorKey)
        NSLog("Silver Bank: private watch history operation failed.")
    }

    func page(before: Int64? = nil, pendingKinds: [String]? = nil, limit: Int = 200) throws -> [Observation] {
        guard (1...500).contains(limit), before == nil || before! > 0 else {
            throw Self.failure("Invalid watch history page.")
        }
        var predicates = [String](), values = [Value]()
        if let before { predicates.append("sequence < ?"); values.append(.integer(before)) }
        if let kinds = pendingKinds {
            guard !kinds.isEmpty, kinds.count <= 2, kinds.allSatisfy({ ["heart_rate", "steps"].contains($0) }) else {
                throw Self.failure("Choose valid history upload categories.")
            }
            predicates.append("uploaded=0 AND kind IN (" + kinds.map { _ in "?" }.joined(separator: ",") + ")")
            values += kinds.map { .text($0) }
        }
        let filter = predicates.isEmpty ? "" : " WHERE " + predicates.joined(separator: " AND ")
        values.append(.integer(Int64(limit)))
        return try statement("SELECT sequence,id,device_id,device_name,kind,value,received_at,uploaded FROM observations" +
                             filter + " ORDER BY sequence " + (pendingKinds == nil ? "DESC" : "ASC") + " LIMIT ?", values) { row in
            var records = [Observation]()
            while true {
                let result = sqlite3_step(row)
                if result == SQLITE_DONE { break }
                guard result == SQLITE_ROW else { throw Self.failure("Could not read private watch history.") }
                func text(_ column: Int32) throws -> String {
                    guard let pointer = sqlite3_column_text(row, column) else { throw Self.failure("Invalid private history record.") }
                    return String(cString: pointer)
                }
                records.append(try Observation(sequence: sqlite3_column_int64(row, 0), id: text(1),
                    deviceId: text(2), deviceName: text(3), kind: text(4), value: Int(sqlite3_column_int64(row, 5)),
                    receivedAt: sqlite3_column_double(row, 6), uploaded: sqlite3_column_int(row, 7) == 1))
            }
            return records
        }
    }

    func counts() throws -> (total: Int64, pending: Int64) {
        (try scalar("SELECT COUNT(*) FROM observations"),
         try scalar("SELECT COUNT(*) FROM observations WHERE uploaded=0"))
    }

    func markUploaded(_ ids: [String]) throws {
        guard !ids.isEmpty, ids.count <= 100, ids.allSatisfy({ $0.hasPrefix("sb-local:") && $0.count == 45 }) else {
            throw Self.failure("Invalid history upload receipt.")
        }
        let parameters = ids.map { _ in "?" }.joined(separator: ",")
        try execute("UPDATE observations SET uploaded=1 WHERE id IN (" + parameters + ")", ids.map { .text($0) })
    }

    func deleteAll() throws {
        try execute("DELETE FROM observations")
        UserDefaults.standard.removeObject(forKey: errorKey)
    }
}
