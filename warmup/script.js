const startBtn = document.getElementById("startBtn");

startBtn.addEventListener("click", () => {
    alert('Assessment started!');
});

const courseNames = ["IT", "CS", "IS"];

const fullCourseNames = courseNames.map(course => {
    return 'BS ' + course;
});

console.log(fullCourseNames);

const getUsers = async () => {
  const response = await fetch('https://jsonplaceholder.typicode.com/users');
  const data = await response.json();
  console.log(data);
};

getUsers();