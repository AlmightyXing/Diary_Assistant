---
trigger: always_on
---

# Log

- Each time finish a command from user, log everything you have done in today's `log.md` file in `logs` folder. For example, the log file for 2026-06-26 is called `log-260626.md`.
- Each `log.md` starts with the title of the date of it built up on. EXP: `# 日志 YYYY-MM-DD`
- DO NOT OVERWRITE THE FILE. Just add what's new at last line.
- Each adding start from a timestamp accurated to minute. For example, a log written at 17:30 would like:
    ```
    - [17:30] Finish the command from user.
    ```
- When a project issue/task is mentioned for the first time, provide a brief description of its contents.
- When recording the implementation of an issue, briefly describe the implementation method and technical details.

## Log Example

```
# 日志 2026-07-05

- [14:20] 项目创建
- [14:40] 创建初始环境，确定工作流程
- [15:30] 初步确立了项目目标，撰写PRD
```