#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""新服务器功能验证：健康检查 / 首页 / 验证码邮件 / 商品图片 / AI 未接降级。"""
import json
import sys
import urllib.request
import urllib.error

BASE = "http://47.99.142.184"


def post(path, payload, timeout=60):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")


def get(path, timeout=30):
    try:
        with urllib.request.urlopen(BASE + path, timeout=timeout) as r:
            return r.status, r.read().decode("utf-8", "replace")[:300]
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", "replace")[:300]


def main():
    print("== 1. 健康检查 ==")
    print(get("/api/health"))

    print("== 2. 首页 ==")
    status, body = get("/")
    print(status, "index.html ok" if "html" in body.lower() else body[:120])

    print("== 3. 商品列表 ==")
    status, body = get("/api/products?page=1&pageSize=1")
    print(status, body[:160])

    print("== 4. 验证码邮件（danallextest@163.com）==")
    status, body = post("/api/auth/send-code", {"email": "danallextest@163.com"})
    print(status, body)

    print("== 5. 商品图片 ==")
    req = urllib.request.Request(BASE + "/uploads/img_1793102016585_740700.jpg")
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            print("img_status=%s type=%s bytes=%s" % (r.status, r.headers.get("Content-Type"), len(r.read())))
    except urllib.error.HTTPError as e:
        print("img_status=%s" % e.code)

    print("== 6. AI 未接（应降级或提示）==")
    status, body = post("/api/agent/chat", {"message": "你好", "sessionId": "test-new-server"}, timeout=90)
    print(status, body[:300])


if __name__ == "__main__":
    sys.exit(main())
