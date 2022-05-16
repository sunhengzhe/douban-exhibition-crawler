# crawler

## 环境

```bash
# Install nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.1/install.sh | bash

# 配置环境变量
# ~/.bash_profile, ~/.zshrc, ~/.profile, or ~/.bashrc
export NVM_DIR="$([ -z "${XDG_CONFIG_HOME-}" ] && printf %s "${HOME}/.nvm" || printf %s "${XDG_CONFIG_HOME}/nvm")"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" # This loads nvm

# 验证
node -v

# 数据库配置
mv .env.sample .env
```

## 安装依赖

npm

```bash
npm install
```

## 运行

```bash
# demo
npm run demo
```