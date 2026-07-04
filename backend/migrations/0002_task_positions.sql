alter table einding.tasks add column if not exists position bigint not null default 0;

update einding.tasks
set position = numbered.rn
from (
  select id, row_number() over (order by created_at asc) as rn
  from einding.tasks
) numbered
where einding.tasks.id = numbered.id;
