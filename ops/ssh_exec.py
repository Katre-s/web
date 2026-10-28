#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""SSH 执行辅助脚本：在新服务器 47.99.142.184 上执行命令。

用法：
    python ops/ssh_exec.py "命令"
    python ops/ssh_exec.py --script ops/remote_deploy.sh   # 上传并执行本地脚本
环境变量可覆盖：
    SSH_HOST / SSH_PORT / SSH_USER / SSH_PASS
"""
import os
import sys
import paramiko

HOST = os.environ.get("SSH_HOST", "47.99.142.184")
PORT = int(os.environ.get("SSH_PORT", "22"))
USER = os.environ.get("SSH_USER", "root")
PASS = os.environ.get("SSH_PASS", "Wcy123456")


def connect():
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(HOST, port=PORT, username=USER, password=PASS,
                timeout=25, banner_timeout=25, auth_timeout=25)
    return cli


def run(cli, cmd, timeout=600):
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def main():
    args = sys.argv[1:]
    if not args:
        print("usage: python ops/ssh_exec.py \"command\" | --script file")
        return 2
    cli = connect()
    try:
        if args[0] == "--script":
            local = args[1]
            remote = "/tmp/_remote_" + os.path.basename(local)
            sftp = cli.open_sftp()
            sftp.put(local, remote)
            sftp.close()
            code, out, err = run(cli, "bash " + remote, timeout=3600)
        else:
            code, out, err = run(cli, " ".join(args), timeout=1800)
        if out:
            print(out, end="")
        if err:
            print("[stderr]", err, end="")
        print("\n[exit=%s]" % code)
        return code
    finally:
        cli.close()


if __name__ == "__main__":
    sys.exit(main())
