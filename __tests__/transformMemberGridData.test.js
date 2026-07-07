const { transformMemberGridData } = require('../controllers/osm-legacy');

describe('transformMemberGridData', () => {
  const buildRawData = (memberOverrides = {}) => ({
    status: true,
    error: null,
    data: {
      '12345': {
        first_name: 'Alex',
        last_name: 'Johnson',
        age: '10 / 06',
        patrol: 'Red Six',
        patrol_id: 7,
        active: true,
        joined: '2023-01-01',
        started: '2023-01-01',
        end_date: null,
        date_of_birth: '2015-06-01',
        section_id: 999,
        photo_guid: '1865f4ca-df43-489d-9bc2-a1e7570a5a30',
        pic: true,
        ...memberOverrides,
      },
    },
    meta: { structure: [] },
  });

  it('preserves photo_guid and pic on transformed members', () => {
    const result = transformMemberGridData(buildRawData());

    expect(result.status).toBe(true);
    expect(result.data.members).toHaveLength(1);
    expect(result.data.members[0].photo_guid).toBe('1865f4ca-df43-489d-9bc2-a1e7570a5a30');
    expect(result.data.members[0].pic).toBe(true);
  });

  it('defaults photo_guid to null and pic to false when absent', () => {
    const result = transformMemberGridData(buildRawData({ photo_guid: undefined, pic: undefined }));

    expect(result.data.members[0].photo_guid).toBeNull();
    expect(result.data.members[0].pic).toBe(false);
  });
});
