"""Inspect the real APKs, including their compiled Android manifests (stdlib only)."""
import json
import pathlib
import struct
import sys
import zipfile

if any(name not in {"CeFaci-Client", "CeFaci-Business"} for name in sys.argv[1:]):
    raise SystemExit("Expected CeFaci-Client and/or CeFaci-Business")


def compiled_manifest(data):
    u16 = lambda at: struct.unpack_from("<H", data, at)[0]
    u32 = lambda at: struct.unpack_from("<I", data, at)[0]
    assert u16(0) == 3, "Expected binary Android XML"
    strings, tags = [], []
    offset = u16(2)
    while offset < len(data):
        kind, header, size = u16(offset), u16(offset + 2), u32(offset + 4)
        assert size >= header and offset + size <= len(data)
        if kind == 1:
            count, flags, start = u32(offset + 8), u32(offset + 16), u32(offset + 20)
            for i in range(count):
                at = offset + start + u32(offset + header + i * 4)
                if flags & 0x100:
                    # UTF-8 stores both the UTF-16 character count and byte count.
                    def length8(at):
                        value = data[at]
                        return (((value & 0x7F) << 8) | data[at + 1], at + 2) if value & 0x80 else (value, at + 1)
                    _, at = length8(at)
                    length, at = length8(at)
                    strings.append(data[at:at + length].decode("utf-8"))
                else:
                    length = u16(at)
                    at += 2
                    if length & 0x8000:
                        length = ((length & 0x7FFF) << 16) | u16(at)
                        at += 2
                    strings.append(data[at:at + length * 2].decode("utf-16le"))
        elif kind == 0x102:
            tag = strings[u32(offset + 20)]
            attr_start, attr_size, attr_count = u16(offset + 24), u16(offset + 26), u16(offset + 28)
            attrs = {}
            for i in range(attr_count):
                at = offset + 16 + attr_start + i * attr_size
                name, raw, value_type, value = u32(at + 4), u32(at + 8), data[at + 15], u32(at + 16)
                attrs[strings[name]] = strings[raw] if raw != 0xFFFFFFFF else strings[value] if value_type == 3 else bool(value) if value_type == 0x12 else value
            tags.append((tag, attrs))
        offset += size
    return tags


for name, package, version in [("CeFaci-Client", "ro.cefaci.app", 5), ("CeFaci-Business", "app.cefaci.business", 5)]:
    if len(sys.argv) > 1 and name not in sys.argv[1:]:
        continue
    apk = pathlib.Path("release") / (name + ".apk")
    with zipfile.ZipFile(apk) as archive:
        assert archive.testzip() is None, apk
        entries = archive.namelist()
        assert "classes.dex" in entries and any(x.startswith("lib/arm64-v8a/") and x.endswith(".so") for x in entries)
        assert not any(x.endswith((".jks", ".keystore", ".env")) for x in entries)
        tags = compiled_manifest(archive.read("AndroidManifest.xml"))
    manifest = next(attrs for tag, attrs in tags if tag == "manifest")
    application = next(attrs for tag, attrs in tags if tag == "application")
    permissions = {attrs["name"] for tag, attrs in tags if tag.startswith("uses-permission")}
    assert manifest["package"] == package and manifest["versionCode"] == version, manifest
    assert application.get("allowBackup", True) is False, "Android backup remains enabled"
    assert application.get("debuggable", False) is False, "Release APK is debuggable"
    assert application.get("usesCleartextTraffic", False) is False, "Cleartext traffic enabled"
    assert "android.permission.RECORD_AUDIO" not in permissions
    assert "android.permission.SYSTEM_ALERT_WINDOW" not in permissions
    if name == "CeFaci-Business":
        assert not permissions & {"android.permission.ACCESS_FINE_LOCATION", "android.permission.ACCESS_COARSE_LOCATION", "android.permission.READ_EXTERNAL_STORAGE", "android.permission.WRITE_EXTERNAL_STORAGE"}
        assert "android.permission.CAMERA" in permissions
    print(json.dumps({"apk": name, "package": package, "versionCode": version, "allowBackup": application["allowBackup"], "permissions": sorted(permissions)}, ensure_ascii=False))
