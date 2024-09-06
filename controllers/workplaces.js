const client = require('../redis/client');

module.exports.getWorkplace = async (req, res, next) => {
  const { userId } = req.params;

  const data = await client.json.get(`workplace:${userId}`);

  try {
    if (!data) {
      const err = new Error('No data was found for this ID');
      err.statusCode = 400;
      throw err;
    }

    res.status(200).send(data);
  } catch (err) {
    next(err);
  }
};

module.exports.editWorkplace = async (req, res, next) => {
  const { userId } = req.params;
  const { workers, locations, notes } = req.body;

  const redis = await client.json.set(`workplace:${userId}`, '$', {
    workers,
    locations,
    notes,
  });

  try {
    if (redis !== 'OK') {
      throw new Error('Update have failed!');
    }

    res.status(200).send('Update was successful');
  } catch (err) {
    next(err);
  }
};

module.exports.editWorkplaceName = async (req, res, next) => {
  const { userId } = req.params;
  const { name } = req.body;

  try {
    if (name === '') {
      const err = new Error('Name cannot be empty!');
      err.statusCode = 400;
      throw err;
    }
    const redis = await client.json.set(`workplace:${userId}`, '$.name', name);

    if (redis !== 'OK') {
      throw new Error('Name could not  be changed!');
    }
    res.status(200).send(redis);
  } catch (err) {
    next(err);
  }
};
