const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const client = require('../redis/client');

module.exports.getUser = async (req, res, next) => {
  const user = await client.hGetAll(`user:${req.userId}`);

  try {
    if (!user.email) {
      const err = new Error('Requested user could not be found!');
      err.statusCode = 404;
      throw err;
    }
    delete user.password;
    user.id = req.userId;

    res.status(200).send(user);
    return;
  } catch (err) {
    next(err);
  }
};

module.exports.signUpRequest = async (req, res, next) => {
  const { email, password, workplace } = req.body;

  const requestId = await client.get('request:id');

  const isActive = await client.zAdd(
    'users',
    {
      value: email,
      score: requestId,
    },
    { NX: true }
  );

  const isNew = await client.zAdd(
    'requests',
    {
      value: email,
      score: requestId,
    },
    { NX: true }
  );

  try {
    if (!isActive) {
      const err = new Error('This email already has an active user!');
      err.statusCode = 400;
      throw err;
    }

    if (!isNew) {
      const err = new Error('Request already exists for this email!');
      err.statusCode = 400;
      throw err;
    }

    const redis = await client.hSet(`request:${requestId}`, {
      email,
      password,
      workplace,
    });

    if (redis !== 3) {
      throw new Error('Request could not be created!');
    }

    client.incr('request:id');
    res.status(200).send('Request sent!');
  } catch (err) {
    next(err);
  }
};

module.exports.signUp = async (req, res, next) => {
  const { email, password, workplace, isAdmin } = req.body;

  const userId = await client.get('user:id');

  const isNew = await client.zAdd(
    'users',
    {
      value: email,
      score: userId,
    },
    { NX: true }
  );

  try {
    if (!isNew) {
      const err = new Error('User already exists!');
      err.statusCode = 400;
      throw err;
    }

    const hash = await bcrypt.hash(password, 12);
    const redis = await client.hSet(`user:${userId}`, {
      email,
      password: hash,
      workplace,
      isAdmin,
    });

    if (redis !== 'OK') {
      throw new Error('User could not be created!');
    }

    client.incr('user:id');
    res.status(200).send('User created!');
  } catch (err) {
    next(err);
  }
};

module.exports.signIn = async (req, res, next) => {
  const { email, password } = req.body;

  const userId = await client.zScore('users', email);

  try {
    if (!userId) {
      const err = new Error('Incorrect email or password');
      err.statusCode = 404;
      throw err;
    }

    const userHash = await client.hGetAll(`user:${userId}`);
    const passMatch = await bcrypt.compare(password, userHash.password);

    if (!passMatch) {
      const err = new Error('Incorrect email or password');
      err.statusCode = 404;
      throw err;
    }

    const { JWT_SECRET } = process.env;
    const token = jwt.sign({ id: userId.toString() }, JWT_SECRET, {
      expiresIn: '7d',
    });

    delete userHash.password;
    userHash.id = userId;
    res.status(200).send({ userHash, token });
  } catch (err) {
    next(err);
  }
};
