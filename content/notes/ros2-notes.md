> 示例笔记，持续更新。

## 1. 订阅不到消息？先查 QoS

发布者用 `BEST_EFFORT`、订阅者用 `RELIABLE` 时，两者**不兼容**，不会报错但收不到消息。

```bash
ros2 topic info /camera/image_raw --verbose
```

看输出里两端的 Reliability 是否一致。

## 2. colcon 只编译改动的包

```bash
colcon build --packages-select my_pkg --symlink-install
```

`--symlink-install` 让 Python 和 launch 文件改完不用重新编译。

## 3. 多机时间同步

真机 + 工控机组网时，用 chrony 同步时间，否则 tf 会报 extrapolation 错误。
