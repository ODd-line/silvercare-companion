import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const plugin=path.join(root,'node_modules/@capacitor-community/bluetooth-le');
assert.equal(JSON.parse(fs.readFileSync(path.join(plugin,'package.json'),'utf8')).version,'7.3.2','Review the SPM wrapper before changing the BLE plugin version');
const registration=fs.readFileSync(path.join(plugin,'ios/Plugin/Plugin.m'),'utf8');
const methods=[...registration.matchAll(/CAP_PLUGIN_METHOD\((\w+),\s*CAPPluginReturnPromise\)/g)].map(match=>match[1]);
assert.equal(new Set(methods).size,methods.length);
for(const name of ['initialize','connect','disconnect','read','startNotifications','stopNotifications'])assert.ok(methods.includes(name),name);
assert.ok(methods.length>=30,'Incomplete plugin method registration');
fs.copyFileSync(path.join(root,'vendor/bluetooth-le.Package.swift'),path.join(plugin,'Package.swift'));
for(const file of ['WatchHistoryStore.swift','SilverBankWatchHistory.swift']){
    fs.copyFileSync(path.join(root,'vendor',file),path.join(plugin,'ios/Plugin',file));
}
const dictionaryPath=path.join(plugin,'ios/Plugin/ThreadSafeDictionary.swift');
const dictionary=fs.readFileSync(dictionaryPath,'utf8');
assert.ok(dictionary.includes('class ThreadSafeDictionary<K: Hashable, T>'));
if(!/^import Foundation\s*$/m.test(dictionary))fs.writeFileSync(dictionaryPath,'import Foundation\n'+dictionary);
for(const name of ['DeviceManager.swift','DeviceListView.swift','Plugin.swift']){
    const file=path.join(plugin,'ios/Plugin',name),source=fs.readFileSync(file,'utf8');
    if(!/^import UIKit\s*$/m.test(source))fs.writeFileSync(file,'import UIKit\n'+source);
}
const devicePath=path.join(plugin,'ios/Plugin/Device.swift');
let deviceSource=fs.readFileSync(devicePath,'utf8').replace(/\r\n/g,'\n');
const closedBefore=`    func getServices() -> [CBService] {`;
const closedAfter=`    func connectionClosed(_ reason: String) {
        self.reject("connect", reason)
        self.reject("discoverServices", reason)
    }

    func getServices() -> [CBService] {`;
if(!deviceSource.includes(closedAfter)){
    assert.equal(deviceSource.split(closedBefore).length,2,'Review the pinned BLE connection-close patch before changing plugin source');
    deviceSource=deviceSource.replace(closedBefore,closedAfter);
}
const discoveryPatches=[
    [
        `        if error != nil {
            log("Error", error!.localizedDescription)
            return
        }
        self.servicesCount = peripheral.services?.count ?? 0`,
        `        if let error = error {
            self.reject("connect", "GATT service discovery failed: \\(error.localizedDescription)")
            self.reject("discoverServices", "GATT service discovery failed: \\(error.localizedDescription)")
            return
        }
        guard let services = peripheral.services, !services.isEmpty else {
            self.reject("connect", "The selected device exposes no GATT services")
            self.reject("discoverServices", "The selected device exposes no GATT services")
            return
        }
        self.servicesCount = services.count`,
    ],
    [
        `        self.servicesDiscovered += 1
        log("didDiscoverCharacteristicsFor", self.servicesDiscovered, self.servicesCount)`,
        `        if let error = error {
            self.reject("connect", "GATT characteristic discovery failed for \\(service.uuid): \\(error.localizedDescription)")
            self.reject("discoverServices", "GATT characteristic discovery failed for \\(service.uuid): \\(error.localizedDescription)")
            return
        }
        self.servicesDiscovered += 1
        log("didDiscoverCharacteristicsFor", self.servicesDiscovered, self.servicesCount)`,
    ],
    [
        `        self.characteristicsDiscovered += 1
        if self.servicesDiscovered >= self.servicesCount`,
        `        if let error = error {
            self.reject("connect", "GATT descriptor discovery failed for \\(characteristic.uuid): \\(error.localizedDescription)")
            self.reject("discoverServices", "GATT descriptor discovery failed for \\(characteristic.uuid): \\(error.localizedDescription)")
            return
        }
        self.characteristicsDiscovered += 1
        if self.servicesDiscovered >= self.servicesCount`,
    ],
];
for(const [before,after] of discoveryPatches){
    if(deviceSource.includes(after))continue;
    assert.equal(deviceSource.split(before).length,2,'Review the pinned BLE discovery patch before changing plugin source');
    deviceSource=deviceSource.replace(before,after);
}
fs.writeFileSync(devicePath,deviceSource);
const managerPath=path.join(plugin,'ios/Plugin/DeviceManager.swift');
let managerSource=fs.readFileSync(managerPath,'utf8').replace(/\r\n/g,'\n');
const discoveryBefore=`        let key = "connect|\\(peripheral.identifier.uuidString)"
        peripheral.discoverServices(nil)
        self.resolve(key, "Successfully connected.")`;
const discoveryAfter=`        let key = "connect|\\(peripheral.identifier.uuidString)"
        log("Service discovery delegate", String(describing: peripheral.delegate))
        let isWatch = peripheral.name == "InfiniTime" || peripheral.name == "PineTime"
        let services: [CBUUID]? = isWatch ? [
            CBUUID(string: "180F"),
            CBUUID(string: "180D"),
            CBUUID(string: "00030000-78FC-48FE-8E23-433B3A1942D0")
        ] : nil
        log("Discovering services", isWatch ? "PineTime battery, heart rate, steps" : "all services")
        peripheral.discoverServices(services)
        self.resolve(key, "Successfully connected.")`;
if(managerSource.includes(discoveryAfter))managerSource=managerSource.replace(discoveryAfter,discoveryBefore);
assert.equal(managerSource.split(discoveryBefore).length,2,'Review the pinned BLE discovery source before changing plugin source');
const disconnectBefore=`        let keyOnDisconnected = "onDisconnected|\\(peripheral.identifier.uuidString)"
        self.resolve(keyOnDisconnected, "Disconnected.")`;
const disconnectAfter=`        let keyOnDisconnected = "onDisconnected|\\(peripheral.identifier.uuidString)"
        let reason: String
        if let error = error as NSError? {
            reason = "Bluetooth disconnected: \\(error.domain) (\\(error.code)): \\(error.localizedDescription)"
        } else {
            reason = "Bluetooth disconnected before discovery completed; iOS provided no error reason"
        }
        log("Peripheral disconnected", peripheral.identifier.uuidString, reason)
        self.resolve(keyOnDisconnected, reason)`;
if(!managerSource.includes(disconnectAfter)){
    assert.equal(managerSource.split(disconnectBefore).length,2,'Review the pinned BLE disconnect patch before changing plugin source');
    managerSource=managerSource.replace(disconnectBefore,disconnectAfter);
}
fs.writeFileSync(managerPath,managerSource);
const pluginPath=path.join(plugin,'ios/Plugin/Plugin.swift');
let pluginSource=fs.readFileSync(pluginPath,'utf8').replace(/\r\n/g,'\n');
const callbackBefore=`        self.deviceManager?.setOnDisconnected(device, {(_, _) in
            let key = "disconnected|\\(device.getId())"`;
const callbackAfter=`        self.deviceManager?.setOnDisconnected(device, {(_, reason) in
            device.connectionClosed(reason)
            let key = "disconnected|\\(device.getId())"`;
if(!pluginSource.includes(callbackAfter.split('\n')[0])){
    assert.equal(pluginSource.split(callbackBefore).length,2,'Review the pinned BLE disconnect callback before changing plugin source');
    pluginSource=pluginSource.replace(callbackBefore,callbackAfter);
}
const historyPatches=[
    [
        '    private var displayStrings = [String: String]()',
        `    private var displayStrings = [String: String]()
    var watchHistoryStore: WatchHistoryStore?
    var watchHistoryContext: (scope: String, deviceId: String, deviceName: String)?`,
    ],
    [
        '            device.connectionClosed(reason)',
        `            device.connectionClosed(reason)
            if self.watchHistoryContext?.deviceId == device.getId() {
                self.watchHistoryContext = nil
                self.watchHistoryStore = nil
            }`,
    ],
    [
        `        device.read(characteristic.0, characteristic.1, timeout, {(success, value) in
            if success {
                call.resolve([`,
        `        device.read(characteristic.0, characteristic.1, timeout, {(success, value) in
            if success {
                self.saveWatchPacket(deviceId: device.getId(), characteristic: characteristic.1, value: value,
                                     receivedAt: Date().timeIntervalSince1970 * 1000, notification: false)
                call.resolve([`,
    ],
    [
        '                self.notifyListeners(key, data: ["value": value])',
        `                let receivedAt = Date().timeIntervalSince1970 * 1000
                self.saveWatchPacket(deviceId: device.getId(), characteristic: characteristic.1,
                                     value: value, receivedAt: receivedAt, notification: true)
                if UIApplication.shared.applicationState == .active {
                    self.notifyListeners(key, data: ["value": value, "receivedAt": receivedAt])
                }`,
    ],
];
for(const [before,after] of historyPatches){
    if(pluginSource.includes(after))continue;
    assert.equal(pluginSource.split(before).length,2,'Review the pinned BLE history patch before changing plugin source');
    pluginSource=pluginSource.replace(before,after);
}
fs.writeFileSync(pluginPath,pluginSource);
fs.writeFileSync(path.join(plugin,'ios/Plugin/SilverBankBridge.swift'),`import Capacitor

extension BluetoothLe: CAPBridgedPlugin {
    public var identifier: String { "BluetoothLe" }
    public var jsName: String { "BluetoothLe" }
    public var pluginMethods: [CAPPluginMethod] {
        [
${[...methods,'configureWatchHistory','readWatchHistory','markWatchHistoryUploaded','deleteWatchHistory'].map(name=>`            CAPPluginMethod(name: "${name}", returnType: CAPPluginReturnPromise)`).join(',\n')}
        ]
    }
}
`);
console.log(`Prepared Capacitor BLE 7.3.2 SPM package with ${methods.length+4} registered methods`);