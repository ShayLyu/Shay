> 这是一篇示例笔记，展示记录页支持的格式：标题、引用、列表、公式、代码、表格。替换成你自己的内容即可。

## 一句话总结

Diffusion Policy 把"根据观测输出动作"建模成一个**条件去噪过程**：从高斯噪声出发，逐步去噪得到一段未来动作序列。

## 为什么用扩散模型？

人类演示天然是**多峰**的：绕过障碍物可以走左边，也可以走右边。用 MSE 回归会把两种模式"平均"成一条撞上去的轨迹，而扩散模型能很好地表达多峰分布。

## 核心公式

训练时，对干净动作 $A^0$ 加噪得到 $A^k$，网络 $\varepsilon_\theta$ 学习预测噪声：

$$
\mathcal{L} = \mathbb{E}_{k,\,\varepsilon}\left[\left\| \varepsilon - \varepsilon_\theta\!\left(O_t,\; A^0_t + \sigma_k \varepsilon,\; k\right) \right\|^2\right]
$$

推理时迭代去噪：

$$
A^{k-1}_t = \alpha\left(A^k_t - \gamma\, \varepsilon_\theta(O_t, A^k_t, k)\right) + \mathcal{N}(0, \sigma^2 I)
$$

## 关键设计

1. **Action chunk**：一次预测未来 $T_p$ 步，只执行前 $T_a$ 步，然后重新规划（receding horizon）。
2. **视觉条件**：观测特征通过 FiLM 注入去噪网络，而不是和动作拼在一起建模联合分布。
3. **网络结构**：CNN-based（1D 时序 U-Net）更稳，Transformer-based 在高频动作上更好但更难调。

| 设计选择 | 作用 |
| --- | --- |
| 预测动作序列 | 时间一致性，减少抖动 |
| 位置控制 | 比速度控制更稳 |
| DDIM 加速 | 推理步数从 100 降到 ~10 |

## 一段伪代码

```python
def act(obs, steps=10):
    a = torch.randn(T_p, action_dim)
    for k in reversed(range(steps)):
        eps = model(obs, a, k)
        a = scheduler.step(eps, k, a)
    return a[:T_a]
```

## 我的思考

- 推理延迟仍然是真机部署的主要瓶颈，可以关注 consistency policy 等一步生成的方法。
- 多峰性在**长程任务**中是否同样重要？值得做个小实验验证。
