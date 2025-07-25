const { ThreadType } = require("zca-js");

module.exports.config = {
  name: "adduser",
  version: "1.0.0", 
  role: 2, 
  author: "Soulmate",
  description: "Thêm người dùng vào nhóm bằng User ID hoặc số điện thoại.",
  category: "Quản lý nhóm",
  usage: "adduser <userId_hoac_sdt>",
  cooldowns: 5,
  dependencies: {}
};

module.exports.run = async ({ args, event, api }) => {
  const { threadId, type } = event;
  const targetInput = args[0];
  if (type !== ThreadType.Group) {
    await api.sendMessage({
      msg: "Lệnh này chỉ có thể sử dụng trong nhóm thôi nhé!",
      ttl: 30000  // Tự xóa sau 30 giây
    }, threadId, type);
    return;
  }

  if (!targetInput) {
    await api.sendMessage({
      msg: "Bạn cần cung cấp User ID hoặc số điện thoại của người muốn thêm vào nhóm. Ví dụ: /adduser 0000000000000000001 hoặc /adduser 0912345678",
      ttl: 30000  // Tự xóa sau 30 giây
    }, threadId, type);
    return;
  }

  let memberIdToAdd = targetInput;

  if (!isNaN(targetInput) && targetInput.length >= 9 && targetInput.length <= 11) {
    try {
      const userInfo = await api.findUser(targetInput);
      if (userInfo && userInfo.uid) {
        memberIdToAdd = userInfo.uid;
      } else {
        await api.sendMessage({
          msg: `Không tìm thấy tài khoản Zalo nào với số điện thoại "${targetInput}". Vui lòng kiểm tra lại số điện thoại hoặc thử nhập User ID trực tiếp nhé.`,
          ttl: 30000  // Tự xóa sau 30 giây
        }, threadId, type);
        return;
      }
    } catch (error) {
      console.error(`Lỗi khi tìm kiếm người dùng bằng SĐT ${targetInput}:`, error);
      let errorMessage = "Đã xảy ra lỗi khi tìm kiếm người dùng bằng số điện thoại. ";
      if (error.code === 216) {
          errorMessage += "Số điện thoại này có thể không hợp lệ hoặc không liên kết với tài khoản Zalo nào.";
      } else {
          errorMessage += "Vui lòng thử lại sau!";
      }
      await api.sendMessage({
        msg: errorMessage,
        ttl: 30000  // Tự xóa sau 30 giây
      }, threadId, type);
      return;
    }
  }

  try {
    const response = await api.addUserToGroup(memberIdToAdd, threadId);

    if (response && response.errorMembers && response.errorMembers.length > 0) {
      await api.sendMessage({
        msg: `Không thể thêm người dùng có ID: ${response.errorMembers.join(", ")} vào nhóm. Có thể họ đã có trong nhóm hoặc đã chặn bot.`,
        ttl: 30000  // Tự xóa sau 30 giây
      }, threadId, type);
    } else {
      await api.sendMessage({
        msg: `Đã thêm người dùng có ID "${memberIdToAdd}" vào nhóm thành công!`,
        ttl: 30000  // Tự xóa sau 30 giây
      }, threadId, type);
    }
  } catch (error) {
    console.error("Lỗi khi thêm người dùng vào nhóm:", error);
    let errorMessage = "Đã xảy ra lỗi khi thêm người dùng vào nhóm. Vui lòng thử lại!";
    if (error.code === 104) {
        errorMessage = "Bot không có quyền thêm thành viên vào nhóm. Vui lòng kiểm tra lại quyền của bot hoặc thử lại với tài khoản có quyền quản trị.";
    } else if (error.message && error.message.includes("is already in group")) {
        errorMessage = "Người dùng này đã có trong nhóm rồi.";
    }
    await api.sendMessage({
      msg: errorMessage,
      ttl: 30000  // Tự xóa sau 30 giây
    }, threadId, type);
  }
};
