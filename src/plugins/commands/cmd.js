const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

module.exports.config = {
    name: "cmd",
    version: "1.0.0",
    role: 2,
    author: "Soulmate",
    description: "Quản lý và kiểm soát các plugin lệnh của bot.",
    category: "Hệ thống",
    usage: ".cmd <load|unload|loadall|unloadall|list|info> [tên lệnh]",
    cooldowns: 2
};

async function loadModule(api, event, moduleName) {
    const { threadId, type } = event;
    const commandPath = path.join(__dirname, `${moduleName}.js`);
    try {
        if (!fs.existsSync(commandPath)) {
            return api.sendMessage({
                msg: `Không tìm thấy plugin '${moduleName}'.`,
                ttl: 30000  // Tự xóa sau 30 giây
            }, threadId, type);
        }

        delete require.cache[require.resolve(commandPath)];
        const command = require(commandPath);

        if (!command.config || !command.config.name || typeof command.run !== "function") {
            return api.sendMessage({
                msg: `Lệnh '${moduleName}' không hợp lệ hoặc thiếu thông tin.`,
                ttl: 30000  // Tự xóa sau 30 giây
            }, threadId, type);
        }

        const dependencies = command.config.dependencies || {};
        let installedNewDep = false;

        for (const [pkgName, version] of Object.entries(dependencies)) {
            try {
                require.resolve(pkgName);
            } catch {
                api.sendMessage({
                    msg: `🔄 Đang cài package: ${pkgName}@${version || "latest"}`,
                    ttl: 30000  // Tự xóa sau 30 giây
                }, threadId, type);
                try {
                    execSync(`npm install ${pkgName}@${version || "latest"}`, {
                        stdio: "inherit",
                        cwd: path.join(__dirname, "../../../")
                    });
                    installedNewDep = true;
                } catch (err) {
                    return api.sendMessage({
                        msg: `❌ Lỗi khi cài ${pkgName}: ${err.message}`,
                        ttl: 30000  // Tự xóa sau 30 giây
                    }, threadId, type);
                }
            }
        }

        const name = command.config.name.toLowerCase();
        global.client.commands.set(name, command);

        if (typeof command.onLoad === "function") {
            try {
                command.onLoad({ api });
            } catch (e) {
                api.sendMessage({
                    msg: `⚠️ Lỗi trong onLoad của ${name}: ${e.message}`,
                    ttl: 30000  // Tự xóa sau 30 giây
                }, threadId, type);
            }
        }

        if (installedNewDep) {
            api.sendMessage({
                msg: "🔁 Đã cài thêm package. Bot sẽ khởi động lại để áp dụng...",
                ttl: 30000  // Tự xóa sau 30 giây
            }, threadId, type);
            process.exit(2);
        } else {
            api.sendMessage({
                msg: `✅ Đã tải lệnh '${moduleName}' thành công.`,
                ttl: 30000  // Tự xóa sau 30 giây
            }, threadId, type);
        }

    } catch (error) {
        console.error(`Lỗi khi tải lệnh ${moduleName}:`, error);
        return api.sendMessage({
            msg: `❌ Lỗi khi tải lệnh '${moduleName}':\n${error.message}`,
            ttl: 30000  // Tự xóa sau 30 giây
        }, threadId, type);
    }
}

async function unloadModule(api, event, moduleName) {
    const { threadId, type } = event;
    if (!global.client.commands.has(moduleName)) {
        return api.sendMessage({
            msg: `Lệnh '${moduleName}' chưa được tải.`,
            ttl: 30000  // Tự xóa sau 30 giây
        }, threadId, type);
    }
    global.client.commands.delete(moduleName);
    const commandPath = path.join(__dirname, `${moduleName}.js`);
    delete require.cache[require.resolve(commandPath)];
    return api.sendMessage({
        msg: `✅ Đã gỡ thành công lệnh '${moduleName}'.`,
        ttl: 30000  // Tự xóa sau 30 giây
    }, threadId, type);
}

module.exports.run = async function({ api, event, args }) {
    const { threadId, type } = event;

    if (!global.users.admin.includes(event.data.uidFrom)) {
        return api.sendMessage({
            msg: "Bạn không có quyền sử dụng lệnh này.",
            ttl: 30000  // Tự xóa sau 30 giây
        }, threadId, type);
    }

    const action = args[0]?.toLowerCase();
    const moduleName = args[1];

    switch (action) {
        case "load":
            if (!moduleName) return api.sendMessage({
                msg: "Vui lòng nhập tên lệnh cần tải.",
                ttl: 30000  // Tự xóa sau 30 giây
            }, threadId, type);
            await loadModule(api, event, moduleName);
            break;

        case "unload":
            if (!moduleName) return api.sendMessage({
                msg: "Vui lòng nhập tên lệnh cần gỡ.",
                ttl: 30000  // Tự xóa sau 30 giây
            }, threadId, type);
            await unloadModule(api, event, moduleName);
            break;

        case "loadall":
            try {
                await api.sendMessage({
                    msg: "🔄 Bắt đầu tải lại tất cả lệnh...",
                    ttl: 30000  // Tự xóa sau 30 giây
                }, threadId, type);
                Object.keys(require.cache).forEach(key => {
                    if (key.startsWith(__dirname)) delete require.cache[key];
                });
                global.client.commands.clear();
                const loaderCommand = require("../../core/loaders/command");
                await loaderCommand();
                await api.sendMessage({
                    msg: `✅ Đã tải lại thành công ${global.client.commands.size} lệnh.`,
                    ttl: 30000  // Tự xóa sau 30 giây
                }, threadId, type);
            } catch (error) {
                console.error("Lỗi khi loadall:", error);
                await api.sendMessage({
                    msg: `❌ Lỗi khi tải lại lệnh:\n${error.message}`,
                    ttl: 30000  // Tự xóa sau 30 giây
                }, threadId, type);
            }
            break;

        case "unloadall":
            try {
                const files = fs.readdirSync(__dirname).filter(f => f.endsWith(".js") && f !== "cmd.js");
                let count = 0;
                for (const file of files) {
                    const name = file.replace(".js", "");
                    if (global.client.commands.has(name)) {
                        global.client.commands.delete(name);
                        delete require.cache[require.resolve(path.join(__dirname, file))];
                        count++;
                    }
                }
                await api.sendMessage({
                    msg: `✅ Đã gỡ ${count} lệnh thành công.`,
                    ttl: 30000  // Tự xóa sau 30 giây
                }, threadId, type);
            } catch (error) {
                console.error("Lỗi khi gỡ:", error);
                await api.sendMessage({
                    msg: `❌ Lỗi khi gỡ lệnh:\n${error.message}`,
                    ttl: 30000  // Tự xóa sau 30 giây
                }, threadId, type);
            }
            break;

        case "list":
            const list = Array.from(global.client.commands.keys());
            api.sendMessage({
                msg: `📦 Hiện có ${list.length} lệnh đang hoạt động:\n${list.join(", ")}`,
                ttl: 60000  // Tự xóa sau 60 giây (danh sách dài)
            }, threadId, type);
            break;

        case "info":
            if (!moduleName) return api.sendMessage({
                msg: "Vui lòng nhập tên lệnh cần xem thông tin.",
                ttl: 30000  // Tự xóa sau 30 giây
            }, threadId, type);
            const cmd = global.client.commands.get(moduleName);
            if (!cmd) return api.sendMessage({
                msg: `Lệnh '${moduleName}' chưa được tải hoặc không tồn tại.`,
                ttl: 30000  // Tự xóa sau 30 giây
            }, threadId, type);
            const config = cmd.config;
            const roleText = config.role === 0 ? "Người dùng" : config.role === 1 ? "Support" : "Admin";
            const depsText = config.dependencies ? Object.keys(config.dependencies).join(", ") : "Không có";

            const msg = `🔎 Thông tin lệnh: ${config.name}\n\n` +
                        `- Mô tả: ${config.description}\n` +
                        `- Tác giả: ${config.author}\n` +
                        `- Phiên bản: ${config.version}\n` +
                        `- Quyền hạn: ${roleText}\n` +
                        `- Cách dùng: ${config.usage}\n` +
                        `- Dependencies: ${depsText}`;
            api.sendMessage({
                msg: msg,
                ttl: 60000  // Tự xóa sau 60 giây
            }, threadId, type);
            break;

        default:
            api.sendMessage({
                msg: "📚 Quản lý module bot\n\n" +
                "cmd load <lệnh> - Tải một lệnh\n" +
                "cmd unload <lệnh> - Gỡ một lệnh\n" +
                "cmd loadall - Tải lại tất cả lệnh\n" +
                "cmd unloadall - Gỡ tất cả lệnh\n" +
                "cmd list - Liệt kê các lệnh\n" +
                "cmd info <lệnh> - Xem thông tin lệnh",
                ttl: 60000  // Tự xóa sau 60 giây
            }, threadId, type);
            break;
    }
};
