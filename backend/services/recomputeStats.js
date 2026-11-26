import { Question, Topic, TopicStats, Unit, UnitStats } from '../models.js';
import { calculateImportance } from './scoring.js';

export async function recomputeSubjectStats(subjectId, affectedTopicIds = null) {
  const [units, topics, questions] = await Promise.all([
    Unit.find({ subjectId }).lean(),
    Topic.find({ subjectId }).lean(),
    Question.find({ subjectId, isUnmapped: false })
      .select('paperId year marks topicIds')
      .lean(),
  ]);
  const result = calculateImportance({ units, topics, questions });
  const affected = affectedTopicIds
    ? new Set(affectedTopicIds.map(String))
    : null;
  const affectedUnitIds = affected
    ? new Set(
      topics
        .filter((topic) => affected.has(String(topic._id)))
        .map((topic) => String(topic.unitId))
    )
    : null;

  const topicWrites = result.topicStats
    .filter((stat) => !affected || affected.has(stat.id))
    .map(({ id, ...stats }) =>
      TopicStats.updateOne(
        { subjectId, topicId: id },
        { $set: { ...stats, subjectId, topicId: id } },
        { upsert: true }
      )
    );
  const unitWrites = result.unitStats
    .filter((stat) => !affectedUnitIds || affectedUnitIds.has(stat.id))
    .map(({ id, ...stats }) =>
      UnitStats.updateOne(
        { subjectId, unitId: id },
        { $set: { ...stats, subjectId, unitId: id } },
        { upsert: true }
      )
    );
  await Promise.all([...topicWrites, ...unitWrites]);

  if (!affected) {
    await Promise.all([
      TopicStats.deleteMany({ subjectId, topicId: { $nin: topics.map((topic) => topic._id) } }),
      UnitStats.deleteMany({ subjectId, unitId: { $nin: units.map((unit) => unit._id) } }),
    ]);
  }
  return result;
}
