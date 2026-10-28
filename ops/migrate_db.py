#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把旧服务器 121.40.219.139 的 campus_trade 数据库迁移到新服务器 47.99.142.184。

流程：旧库 mysqldump -> 本地暂存 -> 新库导入 -> 校验表与数据量
"""
import os
import sys
import paramiko

OLD = dict(host="121.40.219.139", user="root", pwd="Wrn123456", db_pwd="Wrn123456!")
NEW = dict(host="47.99.142.184", user="root", pwd="Wcy123456", db_pwd="Wcy123456!")
LOCAL_SQL = os.path.join(os.path.dirname(os.path.abspath(__file__)), "campus_trade.sql")


def connect(host, user, pwd):
    cli = paramiko.SSHClient()
    cli.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    cli.connect(host, port=22, username=user, password=pwd, timeout=25, banner_timeout=25)
    return cli


def run(cli, cmd, timeout=900):
    stdin, stdout, stderr = cli.exec_command(cmd, timeout=timeout, get_pty=True)
    out = stdout.read().decode("utf-8", "replace")
    err = stderr.read().decode("utf-8", "replace")
    code = stdout.channel.recv_exit_status()
    return code, out, err


def main():
    # 1. 旧服务器 dump
    print("== 1. 旧服务器导出数据库 ==", flush=True)
    old = connect(OLD["host"], OLD["user"], OLD["pwd"])
    dump_cmd = ("mysqldump -uroot -p'%s' --single-transaction --default-character-set=utf8mb4 "
                "--set-gtid-purged=OFF --no-tablespaces campus_trade > /tmp/campus_trade.sql 2>/tmp/dump.err; "
                "echo DUMP_RC=$?; ls -lh /tmp/campus_trade.sql; tail -3 /tmp/dump.err"
                % OLD["db_pwd"])
    code, out, err = run(old, dump_cmd)
    print(out, err, flush=True)
    if "DUMP_RC=0" not in out:
        print("dump 失败，退出")
        return 1
    # 2. 下载
    print("== 2. 下载到本地 ==", flush=True)
    sftp = old.open_sftp()
    sftp.get("/tmp/campus_trade.sql", LOCAL_SQL)
    sftp.close()
    old.close()
    size = os.path.getsize(LOCAL_SQL)
    print("local_size=%d bytes" % size, flush=True)

    # 3. 新服务器上传 + 导入
    print("== 3. 上传并导入新服务器 ==", flush=True)
    new = connect(NEW["host"], NEW["user"], NEW["pwd"])
    sftp = new.open_sftp()
    sftp.put(LOCAL_SQL, "/tmp/campus_trade.sql")
    sftp.close()
    imp_cmd = ("mysql -uroot -p'%s' campus_trade < /tmp/campus_trade.sql 2>/tmp/imp.err; echo IMP_RC=$?; "
               "mysql -uroot -p'%s' -N -e \"SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='campus_trade';\" 2>/dev/null; "
               "mysql -uroot -p'%s' -N -e \"SELECT CONCAT('users=',COUNT(*)) FROM campus_trade.users; SELECT CONCAT('products=',COUNT(*)) FROM campus_trade.products;\" 2>/dev/null; "
               "tail -3 /tmp/imp.err"
               % (NEW["db_pwd"], NEW["db_pwd"], NEW["db_pwd"]))
    code, out, err = run(new, imp_cmd, timeout=1800)
    print(out, err, flush=True)
    new.close()
    print("MIGRATE_DONE")
    return 0


if __name__ == "__main__":
    sys.exit(main())
