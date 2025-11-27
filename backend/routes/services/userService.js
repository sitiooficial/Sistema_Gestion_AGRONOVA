//services/userService.jsconst bcrypt = require("bcrypt");
const { User } = require("../database");

async function createUser(username, email, password) {
  const hashed = await bcrypt.hash(password, 10);

  return await User.create({
    username,
    email,
    password: hashed
  });
}

module.exports = { createUser };
